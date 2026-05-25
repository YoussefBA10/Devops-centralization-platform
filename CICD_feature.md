You are implementing CI/CD pipelines and a GitOps tooling update pipeline
for Monetique Eye. The goal is a working, maintainable system — not a
showcase of DevOps tooling. Keep every decision as simple as possible.

Platform stack:
  Backend  : Spring Boot 3.3, Java 17, MySQL 8, Flyway
  Frontend : React 18, Vite, Tailwind CSS
  Metrics  : Prometheus + VictoriaMetrics (central VM, already running)
  Logs     : Elasticsearch + Logstash + Filebeat (central VM, already running)
  CI/CD    : Jenkins (new — Docker container on central VM)
  Registry : Private Docker registry (new — Docker container on central VM)
  App VMs  : Docker group access only, no sudo

Secrets strategy: Jenkins Credentials store only. No Vault, no Spring Cloud,
no external secret manager. Credentials injected into pipelines via
withCredentials(). Document which credentials must be created manually in Jenkins
after first install — that is sufficient for this scale.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 1 — DEPLOY JENKINS AND REGISTRY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add to the existing central VM docker-compose.yml:

  jenkins:
    image: jenkins/jenkins:2.462-lts
    container_name: jenkins
    restart: unless-stopped
    user: root
    ports:
      - "8080:8080"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - /usr/bin/docker:/usr/bin/docker
    networks:
      - monitoring

  registry:
    image: registry:2.8
    container_name: docker_registry
    restart: unless-stopped
    ports:
      - "5000:5000"
    volumes:
      - registry_data:/var/lib/registry
    networks:
      - monitoring

Generate a post-install README: gitops/JENKINS_SETUP.md
Document the exact credentials that must be created manually in Jenkins
(Manage Jenkins → Credentials) after first launch:
  - DOCKER_REGISTRY_URL   : Secret text  — e.g. <central_vm_ip>:5000
  - DOCKER_REGISTRY_CREDS : Username/password — registry login
  - SSH_DEPLOY_KEY        : SSH private key — for deploying to app VMs
  - MONETIQUE_EYE_URL     : Secret text — e.g. http://localhost:8090

That is all. No plugin automation. A human configures these once.

Add Prometheus scrape job for Jenkins:
  gitops/monitoring/prometheus/conf.d/jenkins.yml:
    - job_name: 'jenkins'
      metrics_path: /prometheus
      static_configs:
        - targets: ['jenkins:8080']

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 2 — APP CI/CD PIPELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Two Jenkinsfiles. Both live in gitops/jenkins/pipelines/.
Jenkins jobs are created manually in the UI pointing at these files.
Pipelines are parameterized — one pipeline handles all apps of that type.

Parameters for both pipelines:
  APP_ID          String  — Monetique Eye app ID
  APP_NAME        String  — slug used for image name and container name
  ENV             Choice  — dev | staging | prod
  GIT_REPO        String  — app git repo URL
  GIT_BRANCH      String  — default: main
  TARGET_VM_IP    String  — IP of the target app VM
  TARGET_VM_USER  String  — SSH user (default: deploy)
  HOST_PORT       String  — host port to expose the container on

2.1 — Frontend Jenkinsfile
  (gitops/jenkins/pipelines/Jenkinsfile.frontend)

  pipeline {
    agent any
    options { timestamps(); timeout(time: 20, unit: 'MINUTES') }
    parameters { /* all params above */ }
    environment {
      REGISTRY     = credentials('DOCKER_REGISTRY_URL')
      IMAGE        = "${REGISTRY}/${params.APP_NAME}"
      TAG          = "${params.ENV}-${BUILD_NUMBER}"
      CONTAINER    = "${params.APP_NAME}-${params.ENV}"
      MONETIQUE    = credentials('MONETIQUE_EYE_URL')
    }
    stages {
      stage('Checkout') {
        steps { git branch: params.GIT_BRANCH, url: params.GIT_REPO }
      }
      stage('Install & test') {
        steps {
          sh 'npm ci'
          sh 'npm test -- --watchAll=false --passWithNoTests'
        }
      }
      stage('Build') {
        steps { sh "npm run build" }
      }
      stage('Docker build & push') {
        steps {
          withCredentials([usernamePassword(
            credentialsId: 'DOCKER_REGISTRY_CREDS',
            usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
            sh """
              docker login ${REGISTRY} -u ${REG_USER} -p ${REG_PASS}
              docker build -t ${IMAGE}:${TAG} .
              docker push ${IMAGE}:${TAG}
              docker logout ${REGISTRY}
            """
          }
        }
      }
      stage('Deploy') {
        steps {
          withCredentials([sshUserPrivateKey(
            credentialsId: 'SSH_DEPLOY_KEY', keyFileVariable: 'SSH_KEY')]) {
            script {
              // Save current image for rollback
              env.PREV_IMAGE = sh(returnStdout: true, script: """
                ssh -i \$SSH_KEY -o StrictHostKeyChecking=no \
                  ${params.TARGET_VM_USER}@${params.TARGET_VM_IP} \
                  "docker inspect --format='{{.Config.Image}}' ${CONTAINER} 2>/dev/null || echo none"
              """).trim()

              sh """
                ssh -i \$SSH_KEY -o StrictHostKeyChecking=no \
                  ${params.TARGET_VM_USER}@${params.TARGET_VM_IP} '
                    docker pull ${IMAGE}:${TAG}
                    docker stop ${CONTAINER} 2>/dev/null || true
                    docker rm   ${CONTAINER} 2>/dev/null || true
                    docker run -d \
                      --name ${CONTAINER} \
                      --restart unless-stopped \
                      -p ${params.HOST_PORT}:80 \
                      -e ENV=${params.ENV} \
                      -e APP_VERSION=${TAG} \
                      ${IMAGE}:${TAG}
                  '
              """
            }
          }
        }
      }
      stage('Health check') {
        steps {
          withCredentials([sshUserPrivateKey(
            credentialsId: 'SSH_DEPLOY_KEY', keyFileVariable: 'SSH_KEY')]) {
            script {
              def ok = false
              for (int i = 0; i < 10; i++) {
                sleep 6
                def rc = sh(returnStatus: true, script: """
                  ssh -i \$SSH_KEY -o StrictHostKeyChecking=no \
                    ${params.TARGET_VM_USER}@${params.TARGET_VM_IP} \
                    "curl -sf http://localhost:${params.HOST_PORT} > /dev/null"
                """)
                if (rc == 0) { ok = true; break }
              }
              if (!ok) {
                // Auto-rollback if previous image exists
                if (env.PREV_IMAGE != 'none') {
                  echo "Health check failed — rolling back to ${PREV_IMAGE}"
                  sh """
                    ssh -i \$SSH_KEY -o StrictHostKeyChecking=no \
                      ${params.TARGET_VM_USER}@${params.TARGET_VM_IP} '
                        docker stop ${CONTAINER} || true
                        docker rm   ${CONTAINER} || true
                        docker run -d \
                          --name ${CONTAINER} --restart unless-stopped \
                          -p ${params.HOST_PORT}:80 \
                          ${PREV_IMAGE}
                      '
                  """
                  notifyDeployment('ROLLED_BACK')
                }
                error("Health check failed after 60s")
              }
            }
          }
        }
      }
    }
    post {
      success { script { notifyDeployment('SUCCESS') } }
      failure { script { notifyDeployment('FAILED')  } }
    }
  }

  def notifyDeployment(status) {
    // Simple HTTP POST to Monetique Eye — fire and forget, never fail the build
    try {
      sh """
        curl -sf -X POST ${MONETIQUE}/api/deployments/events \
          -H 'Content-Type: application/json' \
          -d '{"appId":"${params.APP_ID}","env":"${params.ENV}",
               "version":"${TAG}","status":"${status}",
               "buildNumber":"${BUILD_NUMBER}"}'
      """ }
    catch (e) { echo "Deploy notification failed (non-blocking): ${e.message}" }
  }

2.2 — Backend Jenkinsfile
  (gitops/jenkins/pipelines/Jenkinsfile.backend)

  Identical structure to frontend with these differences:

  stage('Build JAR') {
    steps { sh './mvnw clean package -DskipTests' }
  }
  stage('Test') {
    steps { sh './mvnw test' }
    post { always { junit 'target/surefire-reports/*.xml' } }
  }
  // Docker build uses the JAR output:
  // Dockerfile: FROM eclipse-temurin:17-jre, COPY target/*.jar app.jar, ENTRYPOINT ["java","-jar","app.jar"]

  stage('Deploy') {
    // Same SSH pattern as frontend
    // docker run adds -e SPRING_PROFILES_ACTIVE=${params.ENV}
    // DB credentials passed as -e DB_URL -e DB_PASSWORD
    // These come from Jenkins credentials:
    //   withCredentials([string(credentialsId: "DB_URL_${params.ENV}", variable: 'DB_URL'),
    //                    string(credentialsId: "DB_PASS_${params.ENV}", variable: 'DB_PASS')])
    // Document in JENKINS_SETUP.md: create DB_URL_dev, DB_URL_staging, DB_URL_prod,
    //   DB_PASS_dev, DB_PASS_staging, DB_PASS_prod as Secret Text credentials.
  }

  stage('Health check') {
    // curl http://localhost:${HOST_PORT}/actuator/health → expect {"status":"UP"}
  }

  // Production only: add a manual approval input before Deploy stage
  stage('Approve') {
    when { expression { params.ENV == 'prod' } }
    steps { input message: "Deploy ${params.APP_NAME} ${TAG} to production?", ok: "Deploy" }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 3 — GITOPS TOOLING PIPELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

One Jenkinsfile. Runs on the central VM. Triggered manually or on push
to the GitOps repo via webhook. Manages all monitoring tool updates.

3.1 — GitOps repository structure

  gitops/
  ├── versions.yml               ← single source of truth for tool versions
  └── monitoring/
      ├── prometheus/
      │   ├── prometheus.yml
      │   └── rules/
      ├── alertmanager/
      │   └── alertmanager.yml
      ├── logstash/
      │   └── pipelines/main.conf
      └── grafana/
          └── provisioning/

  versions.yml — edit this file to trigger an upgrade:
    prometheus:        v2.53.0
    victoriametrics:   v1.101.0
    elasticsearch:     8.14.3
    logstash:          8.14.3
    grafana:           11.1.0
    alertmanager:      v0.27.0
    blackbox_exporter: v0.25.0

3.2 — Jenkinsfile (gitops/jenkins/pipelines/Jenkinsfile.gitops)

  pipeline {
    agent any
    options { timestamps(); timeout(time: 30, unit: 'MINUTES') }
    stages {

      stage('Checkout') {
        steps {
          git branch: 'main', url: env.GITOPS_REPO_URL
          script {
            env.CHANGED = sh(returnStdout: true,
              script: 'git diff --name-only HEAD~1 HEAD 2>/dev/null || echo all').trim()
          }
        }
      }

      stage('Sync: Prometheus config') {
        when { expression { env.CHANGED.contains('prometheus') || env.CHANGED.contains('all') } }
        steps {
          sh '''
            cp -r gitops/monitoring/prometheus/. /opt/monitoring/prometheus/
            docker exec prometheus promtool check config /etc/prometheus/prometheus.yml
            curl -sf -X POST http://localhost:9090/-/reload
          '''
        }
      }

      stage('Sync: Alertmanager config') {
        when { expression { env.CHANGED.contains('alertmanager') || env.CHANGED.contains('all') } }
        steps {
          sh '''
            cp gitops/monitoring/alertmanager/alertmanager.yml /opt/monitoring/alertmanager/
            curl -sf -X POST http://localhost:9093/-/reload
          '''
        }
      }

      stage('Sync: Logstash pipelines') {
        when { expression { env.CHANGED.contains('logstash') || env.CHANGED.contains('all') } }
        steps {
          sh '''
            cp -r gitops/monitoring/logstash/. /opt/monitoring/logstash/
            docker restart logstash
            sleep 15
            curl -sf http://localhost:9600/_node/stats > /dev/null
          '''
        }
      }

      stage('Sync: Grafana provisioning') {
        when { expression { env.CHANGED.contains('grafana') || env.CHANGED.contains('all') } }
        steps {
          sh '''
            cp -r gitops/monitoring/grafana/. /opt/monitoring/grafana/
            docker restart grafana
            sleep 10
            curl -sf http://localhost:3000/api/health | grep -q '"database":"ok"'
          '''
        }
      }

      stage('Version upgrades') {
        when { expression { env.CHANGED.contains('versions.yml') || env.CHANGED.contains('all') } }
        steps {
          sh '''
            PROM_VER=$(grep "^prometheus:" gitops/versions.yml | awk '{print $2}')
            VM_VER=$(grep   "^victoriametrics:" gitops/versions.yml | awk '{print $2}')
            ES_VER=$(grep   "^elasticsearch:" gitops/versions.yml | awk '{print $2}')
            LS_VER=$(grep   "^logstash:" gitops/versions.yml | awk '{print $2}')
            GF_VER=$(grep   "^grafana:" gitops/versions.yml | awk '{print $2}')
            AM_VER=$(grep   "^alertmanager:" gitops/versions.yml | awk '{print $2}')
          '''

          // ── Backup first ──────────────────────────────────────────
          sh '''
            echo "=== Backing up before upgrade ==="

            # VictoriaMetrics: use snapshot API (never copy files directly)
            SNAP=$(curl -sf "http://localhost:8428/snapshot/create" | \
              python3 -c "import sys,json; print(json.load(sys.stdin)['snapshotName'])")
            echo "VictoriaMetrics snapshot: $SNAP"

            # Elasticsearch: filesystem snapshot (mount /usr/share/elasticsearch/backups)
            curl -sf -X PUT "http://localhost:9200/_snapshot/backup_repo" \
              -H "Content-Type: application/json" \
              -d '{"type":"fs","settings":{"location":"/usr/share/elasticsearch/backups"}}' || true
            SNAP_NAME="pre-upgrade-$(date +%Y%m%d-%H%M%S)"
            RESULT=$(curl -sf -X PUT \
              "http://localhost:9200/_snapshot/backup_repo/${SNAP_NAME}?wait_for_completion=true" \
              -H "Content-Type: application/json" \
              -d '{"indices":"monetique-*","include_global_state":false}')
            echo $RESULT | python3 -c \
              "import sys,json; s=json.load(sys.stdin)['snapshot']['state']; \
               assert s=='SUCCESS', f'Snapshot failed: {s}'"
            echo "Elasticsearch snapshot: $SNAP_NAME"
          '''

          // ── Upgrade stateless tools ────────────────────────────────
          sh '''
            # Prometheus (no persistent data — VictoriaMetrics holds history)
            docker stop prometheus && docker rm prometheus
            docker run -d --name prometheus --restart unless-stopped \
              --network monitoring -p 9090:9090 \
              -v prometheus_data:/prometheus \
              -v /opt/monitoring/prometheus:/etc/prometheus:ro \
              prom/prometheus:${PROM_VER} \
              --config.file=/etc/prometheus/prometheus.yml \
              --storage.tsdb.retention.time=15d \
              --web.enable-lifecycle
            sleep 10
            curl -sf http://localhost:9090/-/ready
          '''

          sh '''
            # Grafana (data in volume — safe)
            docker stop grafana && docker rm grafana
            docker run -d --name grafana --restart unless-stopped \
              --network monitoring -p 3000:3000 \
              -v grafana_data:/var/lib/grafana \
              -v /opt/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro \
              grafana/grafana:${GF_VER}
            sleep 10
            curl -sf http://localhost:3000/api/health | grep -q '"database":"ok"'
          '''

          sh '''
            # Alertmanager (stateless)
            docker stop alertmanager && docker rm alertmanager
            docker run -d --name alertmanager --restart unless-stopped \
              --network monitoring -p 9093:9093 \
              -v /opt/monitoring/alertmanager:/etc/alertmanager:ro \
              prom/alertmanager:${AM_VER}
            sleep 5
            curl -sf http://localhost:9093/-/ready
          '''

          // ── Upgrade VictoriaMetrics (persistent data — snapshot taken) ──
          sh '''
            docker stop victoriametrics && docker rm victoriametrics
            docker run -d --name victoriametrics --restart unless-stopped \
              --network monitoring -p 8428:8428 \
              -v vm_data:/victoria-metrics-data \
              victoriametrics/victoria-metrics:${VM_VER} \
              -storageDataPath=/victoria-metrics-data \
              -retentionPeriod=12
            sleep 10
            curl -sf http://localhost:8428/-/ready
          '''

          // ── Upgrade Elasticsearch (snapshot taken) ─────────────────
          sh '''
            docker stop elasticsearch && docker rm elasticsearch
            docker run -d --name elasticsearch --restart unless-stopped \
              --network monitoring -p 9200:9200 \
              -v es_data:/usr/share/elasticsearch/data \
              -v es_backups:/usr/share/elasticsearch/backups \
              -e discovery.type=single-node \
              -e ES_JAVA_OPTS="-Xms1g -Xmx1g" \
              -e xpack.security.enabled=false \
              docker.elastic.co/elasticsearch/elasticsearch:${ES_VER}

            # Wait up to 90s for healthy
            for i in $(seq 1 18); do
              sleep 5
              STATUS=$(curl -sf "http://localhost:9200/_cluster/health" | \
                python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo red)
              [ "$STATUS" = "yellow" ] || [ "$STATUS" = "green" ] && break
              [ $i -eq 18 ] && echo "Elasticsearch failed to start" && exit 1
            done
          '''

          // ── Upgrade Logstash (stateless) ───────────────────────────
          sh '''
            docker stop logstash && docker rm logstash
            docker run -d --name logstash --restart unless-stopped \
              --network monitoring -p 5044:5044 \
              -v /opt/monitoring/logstash:/usr/share/logstash/config:ro \
              docker.elastic.co/logstash/logstash:${LS_VER}
            sleep 20
            curl -sf http://localhost:9600/_node/stats > /dev/null
          '''
        }
      }

      stage('Final health check') {
        steps {
          sh '''
            echo "=== Health check after changes ==="
            curl -sf http://localhost:9090/-/ready  && echo "Prometheus    OK" || echo "Prometheus    FAIL"
            curl -sf http://localhost:8428/-/ready  && echo "Victoria      OK" || echo "Victoria      FAIL"
            curl -sf http://localhost:9200/_cluster/health && echo "Elasticsearch OK" || echo "Elasticsearch FAIL"
            curl -sf http://localhost:9600/_node/stats     && echo "Logstash      OK" || echo "Logstash      FAIL"
            curl -sf http://localhost:3000/api/health      && echo "Grafana       OK" || echo "Grafana       FAIL"
            curl -sf http://localhost:9093/-/ready         && echo "Alertmanager  OK" || echo "Alertmanager  FAIL"
          '''
        }
      }
    }

    post {
      failure {
        echo """
          ╔══════════════════════════════════════════╗
          ║  GITOPS PIPELINE FAILED — rollback steps ║
          ╚══════════════════════════════════════════╝
          VictoriaMetrics: curl 'http://localhost:8428/snapshot/restore?snapshot=<name>'
          Elasticsearch:   POST http://localhost:9200/_snapshot/backup_repo/<name>/_restore
          Other tools:     revert versions.yml in Git and re-run the pipeline.
        """
      }
    }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 4 — BACKEND: DEPLOYMENT TRACKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1 — Flyway migration V4__deployment_tracking.sql

  CREATE TABLE deployment_event (
    id           VARCHAR(36) PRIMARY KEY,
    app_id       VARCHAR(36) NOT NULL,
    env          VARCHAR(20) NOT NULL,
    version      VARCHAR(100) NOT NULL,
    build_number VARCHAR(20),
    status       VARCHAR(20) NOT NULL,
    -- SUCCESS | FAILED | ROLLED_BACK
    started_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (app_id) REFERENCES application(id)
  );

4.2 — DeploymentService

  recordEvent(appId, env, version, buildNumber, status):
    - Save to deployment_event table.
    - Push a metric to VictoriaMetrics so deployments show as annotations in Grafana:
        POST http://localhost:8428/api/v1/import/prometheus
        Body (plain text): deployment_event{app_id="<id>",env="<env>",
                           version="<version>",status="<status>"} 1 <epoch_ms>
    - Log at INFO level. Never throw — a failed notification must not affect anything.

4.3 — API (two endpoints only)

  POST /api/deployments/events
    Body: { appId, env, version, buildNumber, status }
    Auth: any authenticated user (Jenkins uses the existing service token).
    Calls DeploymentService.recordEvent().
    Returns: 201 Created.

  GET  /api/deployments?appId=&env=&page=0&size=20
    Returns paginated deployment_event list, sorted by started_at DESC.
    Auth: any authenticated user.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 5 — FRONTEND: DEPLOYMENTS TAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a "Deployments" tab to the existing Applications page.
Do NOT create a new page or top-level route. It belongs next to app details.

The tab shows:
  - A table of recent deployments (GET /api/deployments?appId=<current>)
  - Columns: Version, Env badge, Status badge (SUCCESS=green, FAILED=red,
    ROLLED_BACK=amber), Build number, Time ago
  - A "Trigger deploy" button (ADMIN only) that opens a simple modal:
      Select ENV, confirm — then POST to Jenkins API via backend proxy:
      POST /api/cicd/trigger { appId, env, gitBranch }
      Backend proxies to: Jenkins POST /job/<name>/buildWithParameters
      On success: show toast "Pipeline triggered". Refresh the table after 5s.
  - No live log viewer. No DORA metrics. No charts. Just the table and the trigger.
  - Auto-refresh every 30s with a "last updated Xs ago" label.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PART 6 — GRAFANA: DEPLOYMENT ANNOTATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In the existing app observability Grafana dashboard, add one annotation query:

  datasource: Prometheus / VictoriaMetrics
  expr: deployment_event{app_id="$app_id"}
  step: 60s
  title format: Deploy: {{version}}
  text format:  {{status}} · {{env}}
  color: green for SUCCESS, red for FAILED, amber for ROLLED_BACK

This makes every deployment visible as a vertical line on all panels —
latency spikes and error rate changes become immediately correlated with
the deploy that caused them. No extra infrastructure needed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  IMPLEMENTATION ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.  Add Jenkins + Registry to docker-compose.yml
2.  Write gitops/JENKINS_SETUP.md (manual credentials list)
3.  Add Jenkins scrape job to prometheus/conf.d/jenkins.yml
4.  Create gitops/ repo structure + versions.yml + monitoring config files
5.  Write Jenkinsfile.frontend
6.  Write Jenkinsfile.backend
7.  Write Jenkinsfile.gitops
8.  Flyway V4__deployment_tracking.sql
9.  DeploymentService + POST and GET endpoints
10. POST /api/cicd/trigger (Jenkins proxy — 5 lines of RestTemplate)
11. Frontend: Deployments tab on Applications page
12. Grafana: deployment annotation on existing app dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HARD RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- No Vault, no Spring Cloud, no secret manager. Jenkins Credentials only.
- No Groovy shared library. Logic stays inside each Jenkinsfile.
- No DORA metrics, no live log streaming, no regression auto-rollback
  (health check rollback is enough — metric-based rollback requires weeks
  of tuning to avoid false positives, add it later if needed).
- No new top-level pages. Deployments belong in the existing Applications page.
- The GitOps pipeline MUST take backups before any version upgrade and MUST
  verify the backup succeeded before proceeding. This is non-negotiable.
- Every pipeline stage that can fail must fail loudly with a clear message.
  Never use || true to hide failures in upgrade stages.
- The deployment notification from Jenkins (curl to /api/deployments/events)
  is always wrapped in try/catch. A monitoring system being unreachable must
  never block a deployment.
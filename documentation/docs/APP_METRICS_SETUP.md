# Application Metrics Setup Guide

This guide explains how to expose application-level metrics so they can be scraped by Prometheus and displayed in the Monetique Eye Network Monitor.

**Note:** No automated Ansible deployment is used for this setup because it involves application-level code and configuration changes.

---

## Spring Boot (Micrometer)

If you are deploying a Spring Boot application, add the following to your `application.yml` or `application.properties`:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: prometheus,health,info
  metrics:
    tags:
      application: ${spring.application.name}
      vm_id: ${VM_ID:unknown}
      env: ${ENV:dev}
    distribution:
      percentiles-histogram:
        http:
          server:
            requests: true
      slo:
        http:
          server:
            requests: 50ms,100ms,250ms,500ms,1s,2s
```

Ensure the `spring-boot-starter-actuator` and `micrometer-registry-prometheus` dependencies are included in your `pom.xml` or `build.gradle`.

Set `VM_ID` and `ENV` as environment variables in the Docker run command or compose file.

---

## Node.js (prom-client)

If you are deploying a Node.js application, install the `prom-client` package:

```bash
npm install prom-client
```

Add the following to your application entry point (e.g., `index.js` or `app.js`):

```javascript
const client = require('prom-client');
const register = client.register;

client.collectDefaultMetrics({
  labels: {
    app_name: process.env.APP_NAME || 'nodejs-app',
    vm_id: process.env.VM_ID || 'unknown',
    env: process.env.ENV || 'dev'
  }
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5]
});

// Example: Wrap each request handler to observe duration and status.
// app.use((req, res, next) => {
//   const end = httpDuration.startTimer();
//   res.on('finish', () => {
//     end({ method: req.method, route: req.path, status_code: res.statusCode });
//   });
//   next();
// });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

Set `APP_NAME`, `VM_ID`, and `ENV` as environment variables in the Docker run command or compose file.

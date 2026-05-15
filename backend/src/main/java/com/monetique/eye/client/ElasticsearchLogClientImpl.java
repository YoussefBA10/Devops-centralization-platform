package com.monetique.eye.client;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.CountRequest;
import co.elastic.clients.elasticsearch.core.DeleteByQueryRequest;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.monetique.eye.dto.LogEventDTO;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.timelimiter.annotation.TimeLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Component
public class ElasticsearchLogClientImpl implements ElasticsearchLogClient {

    private final ElasticsearchClient esClient;
    private static final String INDEX_PREFIX = "app-logs-";

    public ElasticsearchLogClientImpl(ElasticsearchClient esClient) {
        this.esClient = esClient;
    }

    private String getIndexName() {
        return "app-logs-*,loki-logs-*";
    }

    @Override
    @CircuitBreaker(name = "elasticsearchClient", fallbackMethod = "fallbackSearch")
    public Page<LogEventDTO> searchLogs(String displayName, String keywordName, String nodeName, String queryStr, String severity, Instant from,
            Instant to, Pageable pageable) {
        return CompletableFuture.supplyAsync(() -> executeSearch(displayName, keywordName, nodeName, queryStr, severity, from, to, pageable))
                .join();
    }

    private Page<LogEventDTO> executeSearch(String displayName, String keywordName, String nodeName, String queryStr, String severity, Instant from,
            Instant to, Pageable pageable) {
        try {
            BoolQuery.Builder boolQuery = new BoolQuery.Builder();

            if (nodeName != null && !nodeName.isBlank() && !nodeName.equals(".*")) {
                boolQuery.must(m -> m.bool(b -> b
                    .should(s -> s.term(t -> t.field("agent.hostname.keyword").value(nodeName)))
                    .should(s -> s.term(t -> t.field("host.name.keyword").value(nodeName)))
                    .should(s -> s.wildcard(w -> w.field("nodename.keyword").value("*" + nodeName + "*")))
                    .should(s -> s.wildcard(w -> w.field("node.keyword").value("*" + nodeName + "*")))
                    .minimumShouldMatch("1")
                ));
            }

            // 1. Environment Filter (Mandatory if provided)
            if (displayName != null && !displayName.equals(".*")) {
                boolQuery.filter(f -> f.term(t -> t.field("environment.keyword").value(displayName.toLowerCase())));
            }

            // 2. Service Filter (Conditional)
            if (keywordName != null && !keywordName.isBlank() && !keywordName.equals(".*")) {
                List<String> namesToMatch = new ArrayList<>();
                if (keywordName.contains("|")) {
                    for (String part : keywordName.split("\\|")) {
                        if (!part.isBlank()) {
                            namesToMatch.add(part.trim());
                            namesToMatch.add(part.trim().replace("-", "_"));
                        }
                    }
                } else {
                    namesToMatch.add(keywordName);
                    namesToMatch.add(keywordName.replace("-", "_"));
                }

                if (!namesToMatch.isEmpty()) {
                    boolQuery.must(m -> m.bool(b -> {
                        namesToMatch.forEach(name -> {
                            String wildcardName = "*" + name + "*";
                            b.should(s -> s.wildcard(w -> w.field("service.keyword").value(wildcardName)));
                            b.should(s -> s.wildcard(w -> w.field("service_name.keyword").value(wildcardName)));
                            b.should(s -> s.wildcard(w -> w.field("app.keyword").value(wildcardName)));
                            b.should(s -> s.wildcard(w -> w.field("compose_service.keyword").value(wildcardName)));
                            b.should(s -> s.wildcard(w -> w.field("job.keyword").value(wildcardName)));
                        });
                        return b.minimumShouldMatch("1");
                    }));
                }
            }

            if (queryStr != null && !queryStr.isBlank()) {
                // Ensure wildcards for partial matches if not provided
                String finalQuery = queryStr.contains("*") ? queryStr : "*" + queryStr + "*";
                boolQuery.must(m -> m.queryString(qs -> qs
                        .query(finalQuery)
                        .fields("raw_message", "message", "normalized_summary", "error_type", "category")
                        .analyzeWildcard(true)
                        .defaultOperator(co.elastic.clients.elasticsearch._types.query_dsl.Operator.And)));
            }

            if (severity != null && !severity.isBlank() && !"ALL".equalsIgnoreCase(severity)) {
                boolQuery.filter(f -> f.term(t -> t.field("severity.keyword").value(severity.toUpperCase())));
            }

            if (from != null || to != null) {
                boolQuery.filter(f -> f.range(r -> {
                    var rangeBuilder = r.field("@timestamp");
                    if (from != null)
                        rangeBuilder.gte(co.elastic.clients.json.JsonData.of(from.toString()));
                    if (to != null)
                        rangeBuilder.lte(co.elastic.clients.json.JsonData.of(to.toString()));
                    return rangeBuilder;
                }));
            }

            Query query = Query.of(q -> q.bool(boolQuery.build()));

            SearchRequest request = new SearchRequest.Builder()
                    .index(getIndexName())
                    .query(query)
                    .from((int) pageable.getOffset())
                    .size(Math.min(pageable.getPageSize(), 10000))
                    .sort(s -> s.field(f -> f.field("@timestamp").order(SortOrder.Desc)))
                    .build();

            SearchResponse<ObjectNode> response = esClient.search(request, ObjectNode.class);

            List<LogEventDTO> logs = new ArrayList<>();
            for (Hit<ObjectNode> hit : response.hits().hits()) {
                if (hit.source() != null) {
                    ObjectNode source = hit.source();
                    logs.add(parseLog(hit.id(), source));
                }
            }

            long total = response.hits().total() != null ? response.hits().total().value() : 0;
            return new PageImpl<>(logs, pageable, total);

        } catch (Exception e) {
            log.error("Failed to query ES for application {}: {}", displayName, e.getMessage());
            throw new RuntimeException("Elasticsearch query failed", e);
        }
    }

    // Fallback for CircuitBreaker
    public Page<LogEventDTO> fallbackSearch(String displayName, String keywordName, String nodeName, String queryStr, String severity, Instant from,
            Instant to, Pageable pageable, Throwable t) {
        log.warn("Elasticsearch circuit breaker tripped for appName: {}. Returning empty list. Reason: {}", displayName,
                t.getMessage());
        return new PageImpl<>(new ArrayList<>(), pageable, 0);
    }

    @Override
    @CircuitBreaker(name = "elasticsearchClient")
    public void clearBuffer(String appName) {
        try {
            DeleteByQueryRequest request = new DeleteByQueryRequest.Builder()
                    .index(getIndexName())
                    .query(q -> q.term(t -> t.field("service.keyword").value(appName)))
                    .build();
            esClient.deleteByQuery(request);
            log.info("Cleared buffer for application {}", appName);
        } catch (Exception e) {
            log.error("Failed to clear ES buffer for application {}: {}", appName, e.getMessage());
            throw new RuntimeException("Failed to clear ES buffer", e);
        }
    }

    @Override
    @CircuitBreaker(name = "elasticsearchClient")
    public long getDocumentCount(String appName) {
        try {
            CountRequest request = new CountRequest.Builder()
                    .index(getIndexName())
                    .query(q -> q.term(t -> t.field("service.keyword").value(appName)))
                    .build();
            return esClient.count(request).count();
        } catch (Exception e) {
            log.error("Failed to get document count for application {}: {}", appName, e.getMessage());
            return 0; // Return 0 gracefully on error or index miss
        }
    }

    private LogEventDTO parseLog(String id, ObjectNode source) {
        return LogEventDTO.builder()
                .id(id)
                .timestamp(source.has("@timestamp")
                        ? Instant.parse(source.get("@timestamp").asText())
                        : Instant.now())
                .node(source.has("node") ? source.get("node").asText() : "unknown")
                .service(getField(source, "service", "service_name", "app", "compose_service", "job"))
                .severity(source.has("severity") ? source.get("severity").asText() : (source.has("detected_level") ? source.get("detected_level").asText() : "INFO"))
                .category(source.has("category") ? source.get("category").asText() : "APPLICATION")
                .errorType(getField(source, "errorType", "error_type"))
                .normalizedSummary(getField(source, "normalizedSummary", "normalized_summary"))
                .rawMessage(getField(source, "raw_message", "message"))
                .traceId(source.has("traceId") ? source.get("traceId").asText() : null)
                .uri(getField(source, "uri", "url_path", "request_path", "http_path"))
                .build();
    }

    private String getField(ObjectNode source, String... fieldNames) {
        for (String field : fieldNames) {
            if (source.has(field) && !source.get(field).isNull()) {
                return source.get(field).asText();
            }
        }
        return null;
    }
}

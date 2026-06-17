export const MOCK_LOG_FILES: Array<{ name: string; content: string }> = [
  {
    name: "api-server.log",
    content: `2024-06-15T08:00:01.123Z INFO  Server starting on port 3000
2024-06-15T08:00:01.456Z INFO  Connected to database pool (size=10)
2024-06-15T08:00:02.001Z DEBUG Loading configuration from /etc/app/config.yaml
2024-06-15T08:01:15.789Z INFO  GET /health 200 12ms
2024-06-15T08:02:33.102Z WARN  Slow query detected: SELECT * FROM products took 842ms
2024-06-15T08:05:44.331Z ERROR Failed to process checkout for order #10482
java.lang.NullPointerException: Cannot invoke "PaymentGateway.charge()" because "gateway" is null
    at com.retailer.checkout.CheckoutService.process(CheckoutService.java:142)
    at com.retailer.checkout.CheckoutController.submit(CheckoutController.java:58)
    at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
Caused by: com.retailer.payment.GatewayInitException: API key missing
    at com.retailer.payment.StripeGateway.<init>(StripeGateway.java:31)
2024-06-15T08:05:44.335Z INFO  Retrying checkout with fallback gateway
2024-06-15T08:06:01.002Z FATAL Database connection pool exhausted — shutting down
2024-06-15T08:06:01.003Z ERROR Shutdown hook triggered
2024-06-15T08:10:00.000Z INFO  Scheduled job: sync-inventory started
2024-06-15T08:10:05.221Z WARN  Inventory sync lag: 320 items pending
`,
  },
  {
    name: "worker.log",
    content: `{"timestamp":"2024-06-15T08:00:05.000Z","level":"INFO","message":"Worker process started","workerId":"w-01"}
{"timestamp":"2024-06-15T08:03:12.500Z","level":"DEBUG","message":"Dequeued job type=embedding batch=42"}
2024-06-15 08:04:00.100 ERROR Job embedding-42 failed after 3 retries
Traceback (most recent call last):
  File "/app/jobs/embedding.py", line 88, in run
    result = model.encode(batch)
  File "/app/models/encoder.py", line 45, in encode
    raise RuntimeError("CUDA out of memory")
RuntimeError: CUDA out of memory
2024-06-15 08:04:00.105 WARN  Moving job embedding-42 to dead-letter queue
2024-06-15 08:07:22.300 INFO  Job search-reindex completed in 4.2s
{"timestamp":"2024-06-15T08:08:00.000Z","level":"FATAL","message":"Worker heartbeat missed — process terminating"}
`,
  },
  {
    name: "nginx-access.log",
    content: `2024-06-15T08:01:00.000Z INFO  192.168.1.10 - "GET /api/search?q=shoes" 200
2024-06-15T08:01:01.000Z INFO  192.168.1.11 - "GET /api/search?q=boots" 200
2024-06-15T08:01:02.000Z WARN  192.168.1.12 - "GET /api/search?q=" 400 Bad Request
2024-06-15T08:01:03.000Z ERROR 192.168.1.13 - "POST /api/checkout" 502 upstream timeout
2024-06-15T08:01:04.000Z INFO  192.168.1.14 - "GET /health" 200
`,
  },
];

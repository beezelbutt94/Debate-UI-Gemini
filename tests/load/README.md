# Load testing

```bash
# Local, against a running services/api + services/collab
export TARGET_URL="http://localhost:8000"
export WS_TARGET_URL="ws://localhost:1234"
export API_KEY="<a real API key from your users table>"

k6 run tests/load/k6_distributed_benchmark.js
```

For a distributed run across a cluster via the k6-operator, see
`k8s/testing/k6-testrun.yaml`:

```bash
kubectl create namespace load-testing --dry-run=client -o yaml | kubectl apply -f -
kubectl create configmap k6-benchmark-script \
  --from-file=load_test.js=tests/load/k6_distributed_benchmark.js \
  -n load-testing
kubectl create secret generic benchmark-credentials \
  --from-literal=api-key="<a real API key>" \
  -n load-testing

kubectl apply -f k8s/testing/k6-testrun.yaml
kubectl logs -f -l app=k6 -n load-testing
```

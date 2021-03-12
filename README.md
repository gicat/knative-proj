# knative-proj
Classify Customer Feedback with Knative Services on Kubernetes

# Test URL
* export INGRESS_IP_ADDRESS=$(kubectl --namespace istio-system get service istio-ingressgateway -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')
* curl -d '{"feedback":"All ok!"}' -H "Content-Type:application/json" -X POST http://${INGRESS_IP_ADDRESS}

# knative-proj
Classify Customer Feedback with Knative Services on Kubernetes

# 1) Create a Kubernetes Cluster Using GKE with Managed Istio Installation
## Test URL
* export INGRESS_IP_ADDRESS=$(kubectl --namespace istio-system get service istio-ingressgateway -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')
* curl -d '{"feedback":"All ok!"}' -H "Content-Type:application/json" -X POST http://${INGRESS_IP_ADDRESS}

# 2) Accept and Store Feedback with Google's NoSQL Firestore
## Test URL
* export INGRESS_IP_ADDRESS=$(kubectl --namespace istio-system get service istio-ingressgateway -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')
* curl -d '{"feedback":"All ok!"}' -H "Content-Type:application/json" -X POST http://${INGRESS_IP_ADDRESS}

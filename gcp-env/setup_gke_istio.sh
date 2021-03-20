#!/bin/bash

#gcloud auth login
gcloud config set project integral-bliss-306817
gcloud config set compute/zone europe-west4-c

#gcloud services enable cloudresourcemanager.googleapis.com pubsub.googleapis.com

gcloud container clusters create customer-feedback \
    --cluster-version=1.18.12-gke.1210 \
    --machine-type=n1-standard-2 \
    --num-nodes=4 \
	--workload-pool=integral-bliss-306817.svc.id.goog
	
kubectl apply --filename https://github.com/knative/serving/releases/download/v0.21.0/serving-crds.yaml
kubectl apply --filename https://github.com/knative/serving/releases/download/v0.21.0/serving-core.yaml
kubectl apply --filename https://github.com/knative/net-istio/releases/download/v0.21.0/istio.yaml
kubectl apply --filename https://github.com/knative/net-istio/releases/download/v0.21.0/net-istio.yaml
kubectl apply --filename https://github.com/knative/serving/releases/download/v0.21.0/serving-default-domain.yaml

gcloud pubsub topics create feedback-created
gcloud pubsub topics create feedback-classified

kubectl apply -f ../trigger-func/trigger-func.yaml
kubectl apply -f ../trigger-func/trigger-func-istio.yaml

kubectl create secret generic pubsub-key --from-file=key.json=../trigger-func/pubsub_serviceaccount.json


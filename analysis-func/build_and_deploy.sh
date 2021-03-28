#!/usr/bin/env bash

PROJECT_ID=$(gcloud config get-value project)

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Must run gcloud init first. Exiting."
  exit 0
fi

APP_NAME="analysis-func"

# Create a Kubernetes Service Account (KSA) for the app.
APP_KSA=$APP_NAME
kubectl create serviceaccount $APP_KSA

# Create a Google service account (GSA) for the app.
APP_GSA_NAME=$APP_NAME
gcloud iam service-accounts create $APP_GSA_NAME

APP_GSA="$APP_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Add the permissions (Firestore, Natural Language API, Pub/Sub) that the app
# needs to the Google service account:

# Firestore is called "datastore" in IAM right now, and the most granular level
# you can apply permissions to right now is the entire GCP project containing
# the Firestore database. Therefore, we give the service account permission to
# read and write any document in any Firestore collection.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$APP_GSA" \
  --role roles/datastore.user

# Cloud Natural Language is part of AutoML products. We don't know which model
# it uses though, so even though it supports granularity down to model, we
# apply the binding to the entire project.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$APP_GSA" \
  --role roles/automl.predictor

# The Knative CloudPubSubSource (CPSS) needs to create a subscription to the
# topic and consume its messages. The analysis-func application needs to
# publish messages. To keep things simple for this example, we give the service
# account the Pub/Sub Editor role on the project. This allows all of these
# create and subscribe operations. The CPSS and Knative Service will both use
# this service account. 
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:$APP_GSA" \
  --role roles/pubsub.editor

# Link the app GSA to the app Kubernetes Service Account (KSA) that was created
# in the previous steps.

# 1/2 Linking - Tell Google that the KSA is allowed to impersonate the GSA.
gcloud iam service-accounts add-iam-policy-binding \
  --member "serviceAccount:$PROJECT_ID.svc.id.goog[default/$APP_KSA]" \
  --role roles/iam.workloadIdentityUser \
  "$APP_GSA"

# 2/2 Linking - Tell the KSA that it can impersonate the GSA.
kubectl annotate serviceaccount $APP_NAME \
  "iam.gke.io/gcp-service-account=$APP_GSA" --overwrite

# Build image via Cloud Build
# Knative requires a change to have been made to the service YAML file for it
# to create a new revision. Therefore, we use a unique value for the image tag
# for each build. A Git commit hash is a good choice for this, but because this
# script may be run from outside of a Git repo, we use a random string.
# credit: https://gist.github.com/earthgecko/3089509
VERSION=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w ${1:-32} | head -n 1)
TAG="gcr.io/$PROJECT_ID/$APP_NAME:$VERSION"
gcloud builds submit --tag "$TAG"

# Fill in service.yaml template with project-specific info and then use it to
# deploy. Forward slashes in image name are escaped using backslashes.
cat service.template.yaml \
  | sed "s/{{IMAGE}}/gcr.io\/$PROJECT_ID\/$APP_NAME:$VERSION/g" \
  > service.yaml
kn service apply -f service.yaml

# Create CloudPubSubSource object which creates a subscription to the topic and
# uses the service create in the previous step as a sink.
kubectl apply -f cloudpubsubsource.yaml

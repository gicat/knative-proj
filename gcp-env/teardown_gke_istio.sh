#!/bin/bash

#gcloud auth login
gcloud config set project integral-bliss-306817
gcloud config set compute/zone europe-west4-c

#gcloud container clusters resize customer-feedback --num-nodes=0
gcloud container clusters delete customer-feedback --zone=europe-west4-c

gcloud pubsub topics delete feedback-created
gcloud pubsub topics delete feedback-classified
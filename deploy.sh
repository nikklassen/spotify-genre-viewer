#!/bin/bash

if [ -z $VERSION ]; then
    echo 'Please specify the version'
    exit 1
fi

if [ -z $MACHINE ]; then
    echo 'Please specify a machine to deploy on'
    exit 1
fi

export VERSION=$VERSION
IMAGE="$DOCKER_USERNAME/spotify-genre-viewer:$VERSION"

source .env
webpack -p --config webpack.config.prod.js

# Build locally
eval $(docker-machine env default)
docker-compose build
docker login -u $DOCKER_USERNAME -p $DOCKER_PASSWORD
docker push $IMAGE

eval $(docker-machine env $MACHINE)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

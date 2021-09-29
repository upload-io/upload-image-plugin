#
# Adapted from: https://github.com/serverlesspub/imagemagick-aws-lambda-2/blob/141ce4cd7543001b3f7742e51ca30ccb73c84596/Makefile
#
PROJECT_ROOT = $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

DOCKER_IMAGE = uploadio/upload-image-plugin-magick-builder:latest

MOUNTS = -v $(PROJECT_ROOT):/var/task

DOCKER = docker run -it --rm -w=/var/task/build

all: docker-build
	$(DOCKER) $(MOUNTS) --entrypoint /usr/bin/make -t $(DOCKER_IMAGE) -f ../Makefile_ImageMagick $@

bash: docker-build
	$(DOCKER) $(MOUNTS) --entrypoint /bin/bash -t $(DOCKER_IMAGE)

docker-build:
	docker build -t $(DOCKER_IMAGE) .

clean:
	rm -rf build result

#
# Adapted from: https://github.com/serverlesspub/imagemagick-aws-lambda-2/blob/141ce4cd7543001b3f7742e51ca30ccb73c84596/Makefile
#
PROJECT_ROOT = $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

DOCKER_IMAGE ?= uploadio/upload-image-plugin-magick-builder:latest
TARGET ?=/opt/

MOUNTS = -v $(PROJECT_ROOT):/var/task \
	-v $(PROJECT_ROOT)result:$(TARGET)

DOCKER = docker run -it --rm -w=/var/task/build
build result:
	mkdir $@

clean:
	rm -rf build result

docker-build:
	docker build -t $(DOCKER_IMAGE) .

list-formats: docker-build
	$(DOCKER) $(MOUNTS) --entrypoint /opt/bin/identify -t $(DOCKER_IMAGE) -list format

bash: docker-build
	$(DOCKER) $(MOUNTS) --entrypoint /bin/bash -t $(DOCKER_IMAGE)

all libs: docker-build
	$(DOCKER) $(MOUNTS) --entrypoint /usr/bin/make -t $(DOCKER_IMAGE) TARGET_DIR=$(TARGET) -f ../Makefile_ImageMagick $@


STACK_NAME ?= imagemagick-layer

result/bin/identify: all

build/layer.zip: result/bin/identify build
	# imagemagick has a ton of symlinks, and just using the source dir in the template
	# would cause all these to get packaged as individual files.
	# (https://github.com/aws/aws-cli/issues/2900)
	#
	# This is why we zip outside, using -y to store them as symlinks

	cd result && zip -ry $(PROJECT_ROOT)$@ *

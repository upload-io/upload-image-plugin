# Memory Estimation Training

## Running the trainer in AWS

### Initial setup

Export the security group ID from your AWS account that grants SSH access to EC2 instances:

```shell
export SSH_ACCESS_SECURITY_GROUP=sg-...
```

Then run deploy an EC2 instance:

```shell
npm run deploy:trainer:new
```

### Subsequent runs

```shell
npm run deploy:trainer:existing
```

### Collecting results

```shell
npm run deploy:trainer:downloadSamples
```

The above downloads the computed samples to the local repo -- you will see the changes with a `git status`.

Note: if command fails with "No such file or directory", then most-likely the sample images are still being generated
on the server.

You can track progress with:

```shell
npm run deploy:trainer:logs
```

If you can't see any `Generated samples` log entries, then it hasn't finished generating samples for a single format yet.

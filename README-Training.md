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

### Checking progress

You can track progress with:

```shell
npm run deploy:trainer:logs
```

### Collecting results

When the samples have been generated, download them with:

```shell
npm run deploy:trainer:downloadSamples
```

### Using the results

1. Train the model locally, after downloading the samples from the EC2 instance (see above):

   ```shell
   npm run trainWithProdSamples
   ```

2. Copy resulting JSON from STDOUT.

3. Paste into `MemoryEstimationModel.ts`

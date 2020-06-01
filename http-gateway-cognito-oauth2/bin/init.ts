#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {GatewayCognitoAuthStack} from "../lib/gateway-cognito-auth";

const app = new cdk.App();

new GatewayCognitoAuthStack(app, 'GatewayCognitoAuth', {
    env: getEnv('aws_env_details'),
    tags: getTags('stack_tags')
});

function getTags(param: string) {
    return app.node.tryGetContext(param)
}

function getEnv(param: string, environment = 'dev') {
    return app.node.tryGetContext(param)[environment]
}



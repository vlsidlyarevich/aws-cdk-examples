import * as cdk from '@aws-cdk/core'

import {UserPool} from "@aws-cdk/aws-cognito";
import {HttpIntegrationType, HttpMethod, PayloadFormatVersion} from "@aws-cdk/aws-apigatewayv2";
import apigateway = require('@aws-cdk/aws-apigatewayv2');
import cognito = require("@aws-cdk/aws-cognito");

export class GatewayCognitoAuthStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const cognitoSetup = new CognitoSetup(this, 'CognitoSetup');
        new GatewaySetup(this, 'GatewaySetup', cognitoSetup.userPool, cognitoSetup.userPoolClient.ref);
    }
}

export class CognitoSetup extends cdk.Construct {

    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.CfnUserPoolClient;

    constructor(parent: cdk.Construct, id: string) {
        super(parent, id);

        this.userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: 'gateway-user-pool',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
                preferredUsername: true,
                username: true
            }
        });
        this.userPool.addDomain('UserPoolDomain', {
            cognitoDomain: {
                domainPrefix: 'gateway'
            }
        });

        const resourceServer = new cognito.CfnUserPoolResourceServer(this, 'ResourceServer', {
            identifier: 'hello',
            name: 'gateway-user-pool-resource-server',
            userPoolId: this.userPool.userPoolId,
            scopes: [{
                scopeDescription: 'Basic scope for say hello',
                scopeName: 'say-hello'
            }]
        });

        this.userPoolClient = new cognito.CfnUserPoolClient(this, 'AppClient', {
            clientName: 'client',
            userPoolId: this.userPool.userPoolId,
            allowedOAuthFlows: ['client_credentials'],
            explicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH', 'ALLOW_CUSTOM_AUTH'],
            allowedOAuthFlowsUserPoolClient: true,
            allowedOAuthScopes: ['hello/say-hello'],
            generateSecret: true,
            supportedIdentityProviders: ['COGNITO']
        });
        this.userPoolClient.addDependsOn(resourceServer);
    }
}

export class GatewaySetup extends cdk.Construct {

    constructor(parent: cdk.Construct, id: string, userPool: UserPool, userPoolClientId: string) {
        super(parent, id);

        const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
            apiName: 'hello-api',
        });

        const httpProxyIntegration = new apigateway.HttpIntegration(this, 'ProxyHttpIntegration', {
            httpApi: httpApi,
            integrationType: HttpIntegrationType.HTTP_PROXY,
            integrationUri: 'http://google.com',
            method: HttpMethod.ANY,
            payloadFormatVersion: PayloadFormatVersion.VERSION_1_0
        });

        const authorizer = new apigateway.CfnAuthorizer(this, 'APIGatewayCognitoAuthorizer', {
            apiId: httpApi.httpApiId,
            name: 'cognito-authorizer',
            authorizerType: 'JWT',
            identitySource: ['$request.header.Authorization'],
            jwtConfiguration: {
                audience: [userPoolClientId],
                issuer: this.getUserPoolURL(userPool.stack.region, userPool)
            }
        });

        new apigateway.CfnRoute(this, 'BillingRoute', {
            apiId: httpApi.httpApiId,
            routeKey: 'GET /hello',
            target: 'integrations/' + httpProxyIntegration.integrationId,
            operationName: 'say-hello',
            authorizerId: authorizer.ref,
            authorizationType: 'JWT',
            authorizationScopes: ['hello/say-hello']
        }).addDependsOn(authorizer);

        new apigateway.HttpStage(this, 'HttpStage', {
            httpApi: httpApi,
            stageName: 'test'
        });
    }

    private getUserPoolURL(region: string, pool: UserPool): string {
        return `https://cognito-idp.${region}.amazonaws.com/${pool.userPoolId}`
    }
}
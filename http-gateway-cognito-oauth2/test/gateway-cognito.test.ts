import * as cdk from "@aws-cdk/core";
import {expect, haveResource} from "@aws-cdk/assert";
import {CognitoSetup, GatewaySetup} from "../lib/gateway-cognito-auth";

class TestApp {
    public readonly stack: cdk.Stack;

    private readonly app: cdk.App;

    constructor() {
        this.app = new cdk.App();

        this.stack = new cdk.Stack(this.app, 'GatewayTestStack');
    }
}

describe('Test cognito setup', function () {
    test('Should setup User pool', () => {
        const app = new TestApp();
        new CognitoSetup(app.stack, 'CognitoSetup');

        expect(app.stack).to(haveResource('AWS::Cognito::UserPool', {
            "AdminCreateUserConfig": {
                "AllowAdminCreateUserOnly": false
            },
            "UserPoolName": "gateway-user-pool"
        }));
    });

    test('Should setup domain for user pool', () => {
        const app = new TestApp();
        new CognitoSetup(app.stack, 'CognitoSetup');

        expect(app.stack).to(haveResource('AWS::Cognito::UserPoolDomain', {
            "Domain": "gateway",
            "UserPoolId": {
                "Ref": "CognitoSetupUserPoolF71EA6B6"
            }
        }));
    });

    test('Should setup resource server', () => {
        const app = new TestApp();
        new CognitoSetup(app.stack, 'CognitoSetup');

        expect(app.stack).to(haveResource('AWS::Cognito::UserPoolResourceServer', {
            "Identifier": "hello",
            "Name": "gateway-user-pool-resource-server",
            "UserPoolId": {
                "Ref": "CognitoSetupUserPoolF71EA6B6"
            },
            "Scopes": [
                {
                    "ScopeDescription": "Basic scope for say hello",
                    "ScopeName": "say-hello"
                }
            ]
        }));
    });

    test('Should setup user pool client', () => {
        const app = new TestApp();
        new CognitoSetup(app.stack, 'CognitoSetup');

        expect(app.stack).to(haveResource('AWS::Cognito::UserPoolClient', {
            "UserPoolId": {
                "Ref": "CognitoSetupUserPoolF71EA6B6"
            },
            "AllowedOAuthFlows": [
                "client_credentials"
            ],
            "AllowedOAuthFlowsUserPoolClient": true,
            "AllowedOAuthScopes": [
                "hello/say-hello"
            ],
            "ClientName": "client",
            "ExplicitAuthFlows": [
                "ALLOW_USER_PASSWORD_AUTH",
                "ALLOW_REFRESH_TOKEN_AUTH",
                "ALLOW_CUSTOM_AUTH"
            ],
            "GenerateSecret": true,
            "SupportedIdentityProviders": [
                "COGNITO"
            ]
        }))
    });
});

describe('Test gateway setup', function () {

    test('Should setup gateway api', () => {
        const app = new TestApp();
        const cognito = new CognitoSetup(app.stack, 'CognitoSetup');
        new GatewaySetup(app.stack, 'GatewaySetup', cognito.userPool, cognito.userPoolClient.ref);

        expect(app.stack).to(haveResource('AWS::ApiGatewayV2::Api', {
            "Name": "hello-api",
            "ProtocolType": "HTTP"
        }));
    });

    test('Should setup http integration', () => {
        const app = new TestApp();
        const cognito = new CognitoSetup(app.stack, 'CognitoSetup');
        new GatewaySetup(app.stack, 'GatewaySetup', cognito.userPool, cognito.userPoolClient.ref);

        expect(app.stack).to(haveResource('AWS::ApiGatewayV2::Integration', {
            "ApiId": {
                "Ref": "GatewaySetupHttpApiF6A84D64"
            },
            "IntegrationType": "HTTP_PROXY",
            "IntegrationMethod": "ANY",
            "IntegrationUri": "http://google.com",
            "PayloadFormatVersion": "1.0"
        }));
    });

    test('Should setup cognito authorizer', () => {
        const app = new TestApp();
        const cognito = new CognitoSetup(app.stack, 'CognitoSetup');
        new GatewaySetup(app.stack, 'GatewaySetup', cognito.userPool, cognito.userPoolClient.ref);

        expect(app.stack).to(haveResource('AWS::ApiGatewayV2::Authorizer', {
            "ApiId": {
                "Ref": "GatewaySetupHttpApiF6A84D64"
            },
            "AuthorizerType": "JWT",
            "IdentitySource": [
                "$request.header.Authorization"
            ],
            "Name": "cognito-authorizer",
            "JwtConfiguration": {
                "Audience": [
                    {
                        "Ref": "CognitoSetupAppClientED8F84E8"
                    }
                ],
                "Issuer": {
                    "Fn::Join": [
                        "",
                        [
                            "https://cognito-idp.",
                            {
                                "Ref": "AWS::Region"
                            },
                            ".amazonaws.com/",
                            {
                                "Ref": "CognitoSetupUserPoolF71EA6B6"
                            }
                        ]
                    ]
                }
            }
        }));
    });

    test('Should setup billing route', () => {
        const app = new TestApp();
        const cognito = new CognitoSetup(app.stack, 'CognitoSetup');
        new GatewaySetup(app.stack, 'GatewaySetup', cognito.userPool, cognito.userPoolClient.ref);

        expect(app.stack).to(haveResource('AWS::ApiGatewayV2::Route', {
            "ApiId": {
                "Ref": "GatewaySetupHttpApiF6A84D64"
            },
            "RouteKey": "GET /hello",
            "AuthorizationScopes": [
                "hello/say-hello"
            ],
            "AuthorizationType": "JWT",
            "AuthorizerId": {
                "Ref": "GatewaySetupAPIGatewayCognitoAuthorizer9AA3F342"
            },
            "OperationName": "say-hello",
            "Target": {
                "Fn::Join": [
                    "",
                    [
                        "integrations/",
                        {
                            "Ref": "GatewaySetupProxyHttpIntegration1CC48224"
                        }
                    ]
                ]
            }
        }));
    });

    test('Should setup test stage', () => {
        const app = new TestApp();
        const cognito = new CognitoSetup(app.stack, 'CognitoSetup');
        new GatewaySetup(app.stack, 'GatewaySetup', cognito.userPool, cognito.userPoolClient.ref);

        expect(app.stack).to(haveResource('AWS::ApiGatewayV2::Stage', {
            "ApiId": {
                "Ref": "GatewaySetupHttpApiF6A84D64"
            },
            "StageName": "test"
        }));
    });
});
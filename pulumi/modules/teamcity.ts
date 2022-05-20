import * as pulumi from "@pulumi/pulumi";
import {TeamCityDatabase} from "../modules/teamcity-database";
import {TeamCityServer} from "../modules/teamcity-server";

export interface TeamCityOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  postgresAdminPassword: pulumi.Input<string>,
}

export class TeamCity extends pulumi.ComponentResource {
  readonly teamCityDatabase: TeamCityDatabase;
  readonly teamCityServer: TeamCityServer;

  constructor(serverName: string, teamCityOptions: TeamCityOptions, opts?: pulumi.ResourceOptions) {
    super("modules:TeamCity", serverName, {}, opts);

    this.teamCityDatabase = new TeamCityDatabase(
        serverName,
        {
          postgresHost: teamCityOptions.postgresHost,
          postgresPort: teamCityOptions.postgresPort,
          postgresAdminPassword: teamCityOptions.postgresAdminPassword,
        },
        {
          parent: this,
        },
    );

    this.teamCityServer = new TeamCityServer(
        serverName,
        {
          postgresHost: teamCityOptions.postgresHost,
          postgresPort: teamCityOptions.postgresPort,
          databasePassword: this.teamCityDatabase.rolePassword,
        },
        {
          dependsOn: [this.teamCityDatabase],
          parent: this,
        },
    );
  }
}

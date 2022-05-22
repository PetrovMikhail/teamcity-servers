import * as pulumi from "@pulumi/pulumi";
import {TeamCityDatabase} from "../modules/teamcity-database";
import {TeamCityServer} from "../modules/teamcity-server";

export interface TeamCityOptions {
  postgresHost: pulumi.Input<string>,
  postgresPort: number,
  postgresAdminPassword: pulumi.Input<string>,
  servicePort: number,
}

/**
 * Class includes objects of TeamCityDatabase and TeamCityServer
 * classes whcih are related with each other.
 */
export class TeamCity extends pulumi.ComponentResource {
  readonly teamCityDatabase: TeamCityDatabase;
  readonly teamCityServer: TeamCityServer;

  /**
     * @param {string} serverName Name of Teamcity server.
     * @param {TeamCityOptions} teamCityOptions Additional options to apply.
     * @param {pulumi.ResourceOptions | undefined} opts Additional pulumi settings.
     */
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
          servicePort: teamCityOptions.servicePort,
        },
        {
          dependsOn: [this.teamCityDatabase],
          parent: this,
        },
    );
  }
}

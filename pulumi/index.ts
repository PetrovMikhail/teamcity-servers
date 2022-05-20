import * as pulumi from "@pulumi/pulumi";
import {PostgreSql} from "./modules/postgresql";
import {TeamCityDatabase} from "./modules/teamcity-database";
import {TeamCity} from "./modules/teamcity";


const postgreSql = new PostgreSql(
    "postgreSql",
    {
      label: "123",
    },
);

const teamCityDatabase = new TeamCityDatabase(
    "teamcity-2",
    {
      postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
      postgresPort: 5432,
      postgresAdminPassword: postgreSql.adminPassword,
    },
    {
      dependsOn: [postgreSql],
    },
);

const teamCity = new TeamCity(
    "teamcity-1",
    {
      postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
      databasePassword: teamCityDatabase.rolePassword,
    },
    {
      dependsOn: [postgreSql, teamCityDatabase],
    },
);

import * as pulumi from "@pulumi/pulumi";
import {PostgreSql} from "./modules/postgresql";
import {TeamCity} from "./modules/teamcity";

const postgreSql = new PostgreSql(
    "postgreSql",
    {
      serviceType: "LoadBalancer",
      serivePort: 5432,
    },
);

const teamCity0 =
  new TeamCity(
      "teamcity-0",
      {
        postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
        postgresPort: 5432,
        postgresAdminPassword: postgreSql.adminPassword,
        servicePort: 8111,
      },
      {
        dependsOn: [postgreSql],
      },
  );

// const teamCity1 =
// new TeamCity(
//     "teamcity-1",
//     {
//       postgresHost: pulumi.interpolate `${postgreSql.helmRelease.name}.${postgreSql.namespace.metadata.name}.svc.cluster.local`,
//       postgresPort: 5432,
//       postgresAdminPassword: postgreSql.adminPassword,
//       servicePort: 8112,
//     },
//     {
//       dependsOn: [postgreSql],
//     },
// );

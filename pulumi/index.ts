import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import {TeamCity} from "./modules/teamcity";

const teamCity = new TeamCity(
    "teamcity-1",
    {
      label: "123",
    },
);

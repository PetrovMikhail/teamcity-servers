# Teamcity servers

Pulumi project for creating and rolling out Teamcity servers into kubernetes cluster.
Project can be started locally but can be automated with CI in the future. 

Requirements:

* Make sure that Node.js is installed. [Install Node.js](https://nodejs.org/en/download/)
* Confirm that Pulumi is installed. [Install Pulumi](https://www.pulumi.com/docs/get-started/install/)
* Kubectl client is installed to connect to kubernetes cluster. [Install kubectl](https://kubernetes.io/ru/docs/tasks/tools/install-kubectl/)
* Docker daemon is installed to be used as a virtualization driver for Minikube. [Install docker daemon](https://docs.docker.com/engine/install/)

## Minikube installation and configuration

To do fast and convinient deployment of Teamcity servers, Minikube installation is highly recommended. Besides, in the current implementation services exposing is based on Minikube usage by default and it should be additionally configured for cloud kubernetes clusters.

To start Minikube cluster, please do the following steps:
1. Install Minikube in any convenient way, see the details: [Minikube installation](https://kubernetes.io/ru/docs/tasks/tools/install-minikube/)
1. Start Minikube cluster with docker driver for virtualization:
    ```shell
    minikube start --vm-driver=docker
    ```
1. Wait until Minikube creates cluster and check that cluster is successfully installed:
    ```shell
    minikube status
    ```
1. Open the separate terminal window and type:
    ```shell
    minikube tunnel
    ```
`minikube tunnel` runs as a process creating a network route on the host to the service CIDR of the cluster using the cluster’s IP address as a gateway. The tunnel command exposes the external IP directly to any program running on the host operating system.
It will allow access to services of type LoadBalancer in minikube cluster and make them availiable in the localhost.
Please don't close this terminal window with the tunnel during the whole Teamcity servers deployment process!

### Minikube recomended parameters
According to Teamcity server docker container recomendations the amount of allocated resources for each container should be quite big. So, for Minikube config parameters it`s a good choise to have at least 4 cpu and 8 Gb of memory. [Configure Minikube](https://minikube.sigs.k8s.io/docs/commands/config/)

## Deploy Teamcity with Pulumi

Initiate the stack to start working with Pulumi. In the separate terminal window change directory to `pulumi` folder and login to pulumi stack running this command:
```shell
pulumi login https://api.pulumi.com
```
By default Pulumi uses own API to store the stack state and the first time you will be asked about the credentials. Login in any convinient way or set up your own Pulumi stack backend, see the detailes here https://www.pulumi.com/docs/intro/concepts/state/.

Then init a new pulumi stack:
```shell
pulumi stack init YOUR_STACK_NAME
pulumi stack select YOUR_STACK_NAME
```
After the successful Pulumi login, install all project dependencies with npm package manager, it might take some time:
```shell
npm install
```
After completing these steps, all is ready to deploy Teamcity server. To preview all possible changes run the command:
```shell
pulumi preview
```
To deploy Teamcity servers in Minikube cluster run:
```shell
pulumi up -y
```

## Configuring bunch of Teamcity servers

To configure amount of Teamcity servers and their parameters, edit `index.ts` file. By default Postgresql and one of the Teamcity servers are deployed in the kubernetes cluster. You can create as many Teamcity servers as you want (within the resources allocated for kubernetes cluster) using creation of new Teamcity class instances with unique server names (for instance, teamcity-0, teamcity-1 etc.).

Also one of the requirements of Minikube implementation is to use different service ports for each Teamcity instance. This condition has to be met to connect to each Teamcity instanse via LoadBalancer service in parallel.

In addition, it is possible to implement a loop for a big amount of instanses creation at the same time. Before this please make sure that kubernetes allocated resources are enough to start all replicas!

### Get access to Teamcity server

Due to Minikube tunnel is running, after the deployment of Teamcity to kuberentes cluster, you will be able to connect to servers via LoadBalancer services. All services extentalIp fields will be equal to `127.0.0.1` value, so to connect to Teamcity, just open `localhost:TEAMCITY_SERVICE_PORT` in your browser command line. It takes some time to start server in Teamcity docker container, so you might have to wait 1-2 minutes to start working via WebUI.

## Backup and restore Teamcity server instances

Each Teamcity server has own database in Postgresql as an extrenal database. Also for each database the new database role is created with own password. Each Teamcity server has an access only to own database for data storage. Database is used to store
server data as well as to backup TC server instance. All needed tables are created in database after the first Teamcity server connection. If Teamcity pod is terminated for some reason, it would be restarted. An option of restoring data from database will be suggested to user via WebUI. Thus, Teamcity server stores the state in extenral database even if there are problems with Teamcity pods (for instance, during pod eviction).

## Future recomendations for production environments

If suggested infrastructure is deployed on the cloud, there are several steps to implement in future:

1. Using services with type `LoadBalancer` for Teamcity servers is OK to expose it for Minikube, but in real environment it leads to a big amount of real load balancers in the cloud. If it's sutable, just use lb addresses to have an access to Teamcity servers. But if it's unacceptable, for instance, if there is a strong limit of resources in a cloud account, you might need to create ingress to get an access to Teamcity servers instead of LoadBalancer services.
1. Using `LoadBalancer` in Posgresql is needed only for database provider creation. In common case service has to be availiable only internally. In general, Posgresql should be located outside of kubernetes cluster, for example in AWS RDS cluster.
1. Apply Teamcity agent into helm chart and install defined amount of Teamcity agents replicas. Also to run jobs in the same kubernetes cluster, Teamcity server plugin is needed. Installation can be done via init container as server drivers installation.
1. Monitoring and logging systems should collect metrics data and logs from Teamcity servers to store information about servers behaviour.
1. Also some values of Teamcity server should be parametrized, like pod resources or environement variables. It allows you to create servers with different parameters for testing purposes. These parameters can be set in Pulumi config file and forwarded to Teamcity class constructor.
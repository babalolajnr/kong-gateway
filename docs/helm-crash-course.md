# Helm Crash Course

## What is Helm?
Helm is a package manager for Kubernetes. It helps you define, install, and upgrade even the most complex Kubernetes applications using reusable packages called "Charts".

## Key Concepts
- **Chart**: A Helm package. It contains all of the resource definitions necessary to run an application, tool, or service inside of a Kubernetes cluster.
- **Release**: An instance of a chart running in a Kubernetes cluster. You can install the same chart multiple times, and each time it creates a new release.
- **Templates**: Files inside `templates/` use the Go template language. They combine with values to generate valid Kubernetes manifest files.
- **Values (`values.yaml`)**: The default configuration values for a chart. You can override these during installation.

## Essential Commands
- `helm create <name>`: Create a new chart with the given name.
- `helm install <release-name> <chart-dir>`: Install a chart and create a new release.
- `helm upgrade <release-name> <chart-dir>`: Upgrade a release to a new version of a chart.
- `helm upgrade --install <release-name> <chart-dir>`: Upgrade if the release exists, otherwise install it.
- `helm list`: List all releases.
- `helm uninstall <release-name>`: Uninstall a release.
- `helm template <chart-dir>`: Render chart templates locally and display the output (great for debugging).

## Helm in this Project
We created a custom chart at `helm/kong-stack` that encapsulates our entire microservice architecture. It defines templates for our ConfigMaps, Deployments, and Services, allowing us to deploy the whole stack with a single `helm upgrade --install` command.

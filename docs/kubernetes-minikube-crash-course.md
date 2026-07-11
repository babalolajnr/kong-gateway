# Kubernetes & Minikube Crash Course

## What is Kubernetes (K8s)?
Kubernetes is an open-source container orchestration engine for automating deployment, scaling, and management of containerized applications.

## What is Minikube?
Minikube is a tool that lets you run Kubernetes locally. It runs a single-node Kubernetes cluster on your personal computer so that you can try out Kubernetes, or for daily development work.

## Key Concepts
- **Pod**: The smallest and simplest Kubernetes object. A Pod represents a set of running containers on your cluster.
- **Deployment**: Provides declarative updates for Pods and ReplicaSets. You describe a desired state, and the Deployment Controller changes the actual state to the desired state.
- **Service**: An abstract way to expose an application running on a set of Pods as a network service.
- **ConfigMap & Secret**: Mechanisms to inject configuration data or sensitive information (passwords, tokens) into Pods without baking them into the container image.

## Essential `kubectl` Commands
- `kubectl get pods`: List all pods in the current namespace.
- `kubectl get services`: List all services.
- `kubectl describe pod <pod-name>`: Show detailed information about a pod, useful for debugging `CrashLoopBackOff` or `Pending` states.
- `kubectl logs <pod-name>`: Print the logs for a container in a pod.
- `kubectl apply -f <file.yaml>`: Apply a configuration to a resource by filename.
- `kubectl delete -f <file.yaml>`: Delete resources defined in a filename.

## Working with Minikube
- `minikube start`: Start the local cluster.
- `minikube dashboard`: Open the web-based Kubernetes dashboard.
- `eval $(minikube docker-env)`: Point your terminal's Docker CLI to the Docker daemon inside Minikube. This allows K8s to use images you build locally without pushing to a registry.
- `minikube service <service-name> --url`: Get the URL to access a NodePort service from your host machine.

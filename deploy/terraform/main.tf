terraform {
  required_version = ">= 1.6.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {}

locals {
  services = {
    ingest = {
      command = ["python", "-m", "bird_project.services.ingest.app"]
      port    = 8001
    }
    catalog = {
      command = ["python", "-m", "bird_project.services.catalog.app"]
      port    = 8002
    }
    analytics = {
      command = ["python", "-m", "bird_project.services.analytics.app"]
      port    = 8003
    }
    orchestrator = {
      command = ["python", "-m", "bird_project.services.orchestrator.app"]
      port    = 8004
    }
    observability = {
      command = ["python", "-m", "bird_project.services.observability.app"]
      port    = 8005
    }
    reporter = {
      command = ["python", "-m", "bird_project.services.reporter.app"]
      port    = 8006
    }
    gateway = {
      command = ["python", "-m", "bird_project.services.gateway.app"]
      port    = 8007
    }
    sync = {
      command = ["python", "-m", "bird_project.services.sync.app"]
      port    = 8008
    }
    warehouse = {
      command = ["python", "-m", "bird_project.services.warehouse.app"]
      port    = 8009
    }
    control = {
      command = ["python", "-m", "bird_project.services.control.app"]
      port    = 8010
    }
  }
}

resource "docker_network" "bird" {
  name = "${var.project_name}-mesh"
}

resource "docker_image" "bird" {
  name = "${var.project_name}:latest"

  build {
    context    = abspath("${path.module}/../..")
    dockerfile = "Dockerfile"
  }
}

resource "docker_container" "services" {
  for_each = local.services

  name  = "bird-${each.key}"
  image = docker_image.bird.image_id
  command = each.value.command

  networks_advanced {
    name = docker_network.bird.name
  }

  ports {
    internal = each.value.port
    external = each.value.port
  }
}

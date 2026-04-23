output "service_ports" {
  value = {
    for name, service in local.services : name => service.port
  }
}


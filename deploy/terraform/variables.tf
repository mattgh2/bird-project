variable "project_name" {
  type        = string
  default     = "bird-project"
  description = "Name prefix used across the local container mesh."
}

variable "container_runtime" {
  type        = string
  default     = "docker"
  description = "Documented for symmetry with larger deployment stacks."
}


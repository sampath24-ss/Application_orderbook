{{/*
Expand the name of the chart.
*/}}
{{- define "multitenant-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "multitenant-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "multitenant-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "multitenant-app.labels" -}}
helm.sh/chart: {{ include "multitenant-app.chart" . }}
{{ include "multitenant-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "multitenant-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "multitenant-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "multitenant-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "multitenant-app.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "multitenant-app.backend.labels" -}}
{{ include "multitenant-app.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "multitenant-app.backend.selectorLabels" -}}
{{ include "multitenant-app.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "multitenant-app.frontend.labels" -}}
{{ include "multitenant-app.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "multitenant-app.frontend.selectorLabels" -}}
{{ include "multitenant-app.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
PostgreSQL labels
*/}}
{{- define "multitenant-app.postgres.labels" -}}
{{ include "multitenant-app.labels" . }}
app.kubernetes.io/component: database
{{- end }}

{{/*
PostgreSQL selector labels
*/}}
{{- define "multitenant-app.postgres.selectorLabels" -}}
{{ include "multitenant-app.selectorLabels" . }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Redis labels
*/}}
{{- define "multitenant-app.redis.labels" -}}
{{ include "multitenant-app.labels" . }}
app.kubernetes.io/component: cache
{{- end }}

{{/*
Redis selector labels
*/}}
{{- define "multitenant-app.redis.selectorLabels" -}}
{{ include "multitenant-app.selectorLabels" . }}
app.kubernetes.io/component: cache
{{- end }}

{{/*
Kafka labels
*/}}
{{- define "multitenant-app.kafka.labels" -}}
{{ include "multitenant-app.labels" . }}
app.kubernetes.io/component: messaging
{{- end }}

{{/*
Kafka selector labels
*/}}
{{- define "multitenant-app.kafka.selectorLabels" -}}
{{ include "multitenant-app.selectorLabels" . }}
app.kubernetes.io/component: messaging
{{- end }}

{{/*
Zookeeper labels
*/}}
{{- define "multitenant-app.zookeeper.labels" -}}
{{ include "multitenant-app.labels" . }}
app.kubernetes.io/component: zookeeper
{{- end }}

{{/*
Zookeeper selector labels
*/}}
{{- define "multitenant-app.zookeeper.selectorLabels" -}}
{{ include "multitenant-app.selectorLabels" . }}
app.kubernetes.io/component: zookeeper
{{- end }}
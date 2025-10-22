import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button, Card, Col, Form as AntdForm, Row, Typography, message } from "antd"
import { ArrowLeft, ArrowSquareOut, Copy, DotsThree, PencilSimple, Trash } from "@phosphor-icons/react"
import { Form as RJSFForm } from "@rjsf/antd"
import validator from "@rjsf/validator-ajv8"
import Form from "@rjsf/antd"

import { useAppStore } from "@store/index"
import { sourceService, jobService } from "@api/index"
import { Source, SourceJob } from "@app-types/index"
import {
  getConnectorImage,
  getConnectorDocumentationPath,
  getFormDataFromSpec,
  handleSpecResponse,
  withAbortController,
} from "@utils/utils"
import { getStatusIcon } from "@utils/statusIcons"
import {
  CONNECTOR_TYPES,
  SOURCE_INTERNAL_TYPES,
  SOURCE_TYPES,
  DEFAULT_SOURCE_TYPE,
  DISPLAYED_JOBS_COUNT,
  OLAKE_LATEST_VERSION_URL,
  transformErrors,
  TEST_CONNECTION_STATUS,
} from "@utils/constants"
import DocumentationPanel from "@modules/common/components/DocumentationPanel"
import StepTitle from "@modules/common/components/StepTitle"
import DeleteModal from "@modules/common/Modals/DeleteModal"
import TestConnectionSuccessModal from "@modules/common/Modals/TestConnectionSuccessModal"
import TestConnectionFailureModal from "@modules/common/Modals/TestConnectionFailureModal"
import TestConnectionModal from "@modules/common/Modals/TestConnectionModal"
import EntityEditModal from "@modules/common/Modals/EntityEditModal"
import { connectorOptions } from "@modules/sources/components/connectorOptions"
import ObjectFieldTemplate from "@modules/common/components/Form/ObjectFieldTemplate"
import CustomFieldTemplate from "@modules/common/components/Form/CustomFieldTemplate"
import ArrayFieldTemplate from "@modules/common/components/Form/ArrayFieldTemplate"
import { widgets } from "@modules/common/components/Form/widgets"

const SourceEdit = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [form] = AntdForm.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTestConnectionModal, setShowTestConnectionModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showFailureModal, setShowFailureModal] = useState(false)
  const [testConnectionError, setTestConnectionError] = useState<any>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [jobs, setJobs] = useState<SourceJob[]>([])
  const [schema, setSchema] = useState<any>(null)
  const [uiSchema, setUiSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [connectorType, setConnectorType] = useState<string>(DEFAULT_SOURCE_TYPE)

  const {
    showEditSourceModal,
    setShowEditSourceModal,
    setShowSuccessModal: setGlobalSuccessModal,
    setShowFailureModal: setGlobalFailureModal,
    setTestConnectionError: setGlobalTestConnectionError,
  } = useAppStore()

  useEffect(() => {
    if (id) {
      fetchSource()
      fetchJobs()
    }
  }, [id])

  const fetchSource = async () => {
    try {
      setLoading(true)
      const response = await sourceService.getSource(id!)
      setSource(response.data)
      setConnectorType(response.data.type)
      await fetchConnectorSpec(response.data.type)
    } catch (error) {
      console.error("Error fetching source:", error)
      message.error("Failed to load source details")
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const response = await jobService.getJobs({
        source_id: id,
        limit: DISPLAYED_JOBS_COUNT,
        sort: "-created_at",
      })
      setJobs(response.data.jobs)
    } catch (error) {
      console.error("Error fetching jobs:", error)
    }
  }

  const fetchConnectorSpec = async (type: string) => {
    try {
      const response = await sourceService.getSourceSpec(type)
      const { schema: specSchema, uiSchema: specUiSchema } = handleSpecResponse(
        response.data.spec
      )
      setSchema(specSchema)
      setUiSchema(specUiSchema)

      if (source) {
        const formData = getFormDataFromSpec(source.config, specSchema)
        setFormData(formData)
      }
    } catch (error) {
      console.error("Error fetching connector spec:", error)
      message.error("Failed to load connector specification")
    }
  }

  const handleSubmit = async (formData: any) => {
    if (!source) return

    try {
      setSaving(true)
      await sourceService.updateSource(id!, {
        ...source,
        config: formData,
      })
      
      message.success("Source updated successfully")
      navigate("/sources")
    } catch (error) {
      console.error("Error updating source:", error)
      message.error("Failed to update source")
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!source) return

    try {
      setTesting(true)
      const response = await sourceService.testSourceConnection({
        type: connectorType,
        config: formData,
      })

      if (response.data.connection_result.status === TEST_CONNECTION_STATUS.SUCCEEDED) {
        setShowSuccessModal(true)
      } else {
        setTestConnectionError({
          message: response.data.connection_result.message,
          logs: response.data.logs || [],
        })
        setShowFailureModal(true)
      }
    } catch (error) {
      console.error("Error testing connection:", error)
      message.error("Failed to test connection")
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!source) return

    try {
      await sourceService.deleteSource(id!)
      message.success("Source deleted successfully")
      navigate("/sources")
    } catch (error) {
      console.error("Error deleting source:", error)
      message.error("Failed to delete source")
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!source) {
    return <div>Source not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            type="text"
            icon={<ArrowLeft size={20} />}
            onClick={() => navigate(-1)}
          />
          <div>
            <Typography.Title level={4} className="mb-0">
              Edit Source
            </Typography.Title>
            <Typography.Text type="secondary">
              {SOURCE_TYPES[connectorType]?.name || connectorType}
            </Typography.Text>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            type="default"
            icon={<PencilSimple size={16} />}
            onClick={() => setShowEditModal(true)}
          >
            Edit
          </Button>
          <Button
            danger
            type="text"
            icon={<Trash size={16} />}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card className="mb-6">
            <StepTitle
              title="Source Configuration"
              stepNumber={1}
              className="mb-6"
            />
            {schema && (
              <Form
                schema={schema}
                uiSchema={uiSchema}
                formData={formData}
                validator={validator}
                onChange={({ formData }) => setFormData(formData)}
                onSubmit={({ formData }) => handleSubmit(formData)}
                templates={{
                  ObjectFieldTemplate,
                  FieldTemplate: CustomFieldTemplate,
                  ArrayFieldTemplate,
                }}
                widgets={widgets}
                transformErrors={transformErrors}
                onError={console.error}
              >
                <div className="flex justify-end space-x-3">
                  <Button
                    type="default"
                    loading={testing}
                    onClick={() => setShowTestConnectionModal(true)}
                  >
                    Test Connection
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={saving}
                    className="bg-blue-600"
                  >
                    Save Changes
                  </Button>
                </div>
              </Form>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <DocumentationPanel
            connectorType={connectorType}
            connectorName={SOURCE_TYPES[connectorType]?.name}
            docsPath={getConnectorDocumentationPath(
              connectorType,
              SOURCE_INTERNAL_TYPES
            )}
          />
        </Col>
      </Row>

      <DeleteModal
        entityType="source"
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        jobsCount={jobs.length}
      />

      <EntityEditModal entityType="source" />
      
      <TestConnectionModal
        visible={showTestConnectionModal}
        onCancel={() => setShowTestConnectionModal(false)}
        onTest={handleTestConnection}
        loading={testing}
      />
      
      <TestConnectionSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        entityType="source"
      />
      
      <TestConnectionFailureModal
        visible={showFailureModal}
        error={testConnectionError}
        onClose={() => setShowFailureModal(false)}
        fromSources={true}
      />
    </div>
  )
}

export default withAbortController(SourceEdit)

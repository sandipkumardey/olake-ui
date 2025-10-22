import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button, Card, Col, Form as AntdForm, Row, Typography, message } from "antd"
import { ArrowLeft, ArrowSquareOut, Copy, DotsThree, PencilSimple, Trash } from "@phosphor-icons/react"
import { Form as RJSFForm } from "@rjsf/antd"
import validator from "@rjsf/validator-ajv8"
import Form from "@rjsf/antd"

import { useAppStore } from "@store/index"
import { destinationService } from "@api/services/destinationService"
import { jobService } from "@api/index"
import {
  DestinationEditProps,
  DestinationJob,
  Entity,
  EntityType,
} from "@app-types/index"
import {
  getConnectorImage,
  getConnectorDocumentationPath,
  getFormDataFromSpec,
  getStatusLabel,
  handleSpecResponse,
  withAbortController,
} from "@utils/utils"
import { getStatusIcon } from "@utils/statusIcons"
import {
  CONNECTOR_TYPES,
  DESTINATION_INTERNAL_TYPES,
  DESTINATION_TYPES,
  DEFAULT_DESTINATION_TYPE,
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
import { connectorOptions } from "@modules/destinations/components/connectorOptions"
import ObjectFieldTemplate from "@modules/common/components/Form/ObjectFieldTemplate"
import CustomFieldTemplate from "@modules/common/components/Form/CustomFieldTemplate"
import ArrayFieldTemplate from "@modules/common/components/Form/ArrayFieldTemplate"
import { widgets } from "@modules/common/components/Form/widgets"

const DestinationEdit: React.FC<DestinationEditProps> = ({
  fromJobFlow = false,
  onSuccess,
  onCancel,
}) => {
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
  const [destination, setDestination] = useState<any>(null)
  const [jobs, setJobs] = useState<DestinationJob[]>([])
  const [schema, setSchema] = useState<any>(null)
  const [uiSchema, setUiSchema] = useState<any>(null)
  const [formData, setFormData] = useState<any>({})
  const [connectorType, setConnectorType] = useState<string>(
    DEFAULT_DESTINATION_TYPE
  )

  const {
    showEditDestinationModal,
    setShowEditDestinationModal,
    setShowSuccessModal: setGlobalSuccessModal,
    setShowFailureModal: setGlobalFailureModal,
    setTestConnectionError: setGlobalTestConnectionError,
  } = useAppStore()

  useEffect(() => {
    if (id) {
      fetchDestination()
      fetchJobs()
    }
  }, [id])

  const fetchDestination = async () => {
    try {
      setLoading(true)
      const response = await destinationService.getDestination(id!)
      setDestination(response.data)
      setConnectorType(response.data.type)
      await fetchConnectorSpec(response.data.type)
    } catch (error) {
      console.error("Error fetching destination:", error)
      message.error("Failed to load destination details")
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const response = await jobService.getJobs({
        destination_id: id,
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
      const response = await destinationService.getDestinationSpec(type)
      const { schema: specSchema, uiSchema: specUiSchema } = handleSpecResponse(
        response.data.spec
      )
      setSchema(specSchema)
      setUiSchema(specUiSchema)

      if (destination) {
        const formData = getFormDataFromSpec(destination.config, specSchema)
        setFormData(formData)
      }
    } catch (error) {
      console.error("Error fetching connector spec:", error)
      message.error("Failed to load connector specification")
    }
  }

  const handleSubmit = async (formData: any) => {
    try {
      setSaving(true)
      await destinationService.updateDestination(id!, {
        ...destination,
        config: formData,
      })
      
      message.success("Destination updated successfully")
      if (fromJobFlow && onSuccess) {
        onSuccess()
      } else {
        navigate("/destinations")
      }
    } catch (error) {
      console.error("Error updating destination:", error)
      message.error("Failed to update destination")
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      const response = await destinationService.testDestinationConnection({
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
    try {
      await destinationService.deleteDestination(id!)
      message.success("Destination deleted successfully")
      navigate("/destinations")
    } catch (error) {
      console.error("Error deleting destination:", error)
      message.error("Failed to delete destination")
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!destination) {
    return <div>Destination not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            type="text"
            icon={<ArrowLeft size={20} />}
            onClick={() => (fromJobFlow && onCancel ? onCancel() : navigate(-1))}
          />
          <div>
            <Typography.Title level={4} className="mb-0">
              Edit Destination
            </Typography.Title>
            <Typography.Text type="secondary">
              {DESTINATION_TYPES[connectorType]?.name || connectorType}
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
              title="Destination Configuration"
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
            connectorName={DESTINATION_TYPES[connectorType]?.name}
            docsPath={getConnectorDocumentationPath(
              connectorType,
              DESTINATION_INTERNAL_TYPES
            )}
          />
        </Col>
      </Row>

      <DeleteModal
        entityType="destination"
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        jobsCount={jobs.length}
      />

      <EntityEditModal entityType="destination" />
      
      <TestConnectionModal
        visible={showTestConnectionModal}
        onCancel={() => setShowTestConnectionModal(false)}
        onTest={handleTestConnection}
        loading={testing}
      />
      
      <TestConnectionSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        entityType="destination"
      />
      
      <TestConnectionFailureModal
        visible={showFailureModal}
        error={testConnectionError}
        onClose={() => setShowFailureModal(false)}
        fromSources={false}
      />
    </div>
  )
}

export default withAbortController(DestinationEdit)

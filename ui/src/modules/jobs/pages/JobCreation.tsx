import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button, Card, Col, Form, Row, Select, message } from "antd"
import { ArrowLeft } from "@phosphor-icons/react"
import { Form as RJSFForm } from "@rjsf/antd"
import validator from "@rjsf/validator-ajv8"

import { useAppStore } from "@store/index"
import { jobService, sourceService, destinationService } from "@api/index"
import type { JobType, Source, Destination, Job } from "@app-types/index"
import {
  getConnectorDocumentationPath,
  handleSpecResponse,
  withAbortController,
} from "@utils/utils"
import { JOB_TYPES, transformErrors } from "@utils/constants"
import DocumentationPanel from "@modules/common/components/DocumentationPanel"
import StepTitle from "@modules/common/components/StepTitle"
import ObjectFieldTemplate from "@modules/common/components/Form/ObjectFieldTemplate"
import CustomFieldTemplate from "@modules/common/components/Form/CustomFieldTemplate"

type JobCreationProps = {
  fromJobFlow?: boolean
  onSuccess?: () => void
  onCancel?: () => void
}

const { Option } = Select

const JobCreation = ({
  fromJobFlow = false,
  onSuccess,
  onCancel,
}: JobCreationProps) => {
	const [form] = Form.useForm()
	const navigate = useNavigate()
	const { sourceId, destinationId } = useParams<{
		sourceId?: string
		destinationId?: string
	}>()

	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [sources, setSources] = useState<Source[]>([])
	const [destinations, setDestinations] = useState<Destination[]>([])
	const [selectedSource, setSelectedSource] = useState<Source | null>(null)
	const [selectedDestination, setSelectedDestination] =
		useState<Destination | null>(null)
	const [jobType, setJobType] = useState<JobType>(JOB_TYPES.FULL_REFRESH)
	const [schema, setSchema] = useState<any>(null)
	const [uiSchema, setUiSchema] = useState<any>(null)
	const [formData, setFormData] = useState<any>({})
	const [showAdvanced, setShowAdvanced] = useState(false)

	const { user } = useAppStore()

	useEffect(() => {
		fetchSources()
		fetchDestinations()
	}, [])

	useEffect(() => {
		if (sourceId && sources.length > 0) {
			const source = sources.find(s => s.id === sourceId)
			if (source) {
				setSelectedSource(source)
				form.setFieldsValue({ sourceId })
			}
		}
	}, [sourceId, sources])

	useEffect(() => {
		if (destinationId && destinations.length > 0) {
			const destination = destinations.find(d => d.id === destinationId)
			if (destination) {
				setSelectedDestination(destination)
				form.setFieldsValue({ destinationId })
			}
		}
	}, [destinationId, destinations])

	const fetchSources = async () => {
		try {
			const response = await sourceService.getSources()
			setSources(response.data.sources)
		} catch (error) {
			console.error("Error fetching sources:", error)
			message.error("Failed to load sources")
		}
	}

	const fetchDestinations = async () => {
		try {
			const response = await destinationService.getDestinations()
			setDestinations(response.data.destinations)
		} catch (error) {
			console.error("Error fetching destinations:", error)
			message.error("Failed to load destinations")
		} finally {
			setLoading(false)
		}
	}

	const fetchJobSpec = async (sourceType: string, destinationType: string) => {
		try {
			const response = await jobService.getJobSpec(sourceType, destinationType)
			const { schema: specSchema, uiSchema: specUiSchema } = handleSpecResponse(
				response.data.spec,
			)
			setSchema(specSchema)
			setUiSchema(specUiSchema)
			setFormData({})
		} catch (error) {
			console.error("Error fetching job spec:", error)
			message.error("Failed to load job specification")
		}
	}

	const handleSourceChange = (value: string) => {
		const source = sources.find(s => s.id === value)
		setSelectedSource(source || null)
		if (source && selectedDestination) {
			fetchJobSpec(source.type, selectedDestination.type)
		}
	}

	const handleDestinationChange = (value: string) => {
		const destination = destinations.find(d => d.id === value)
		setSelectedDestination(destination)
		if (selectedSource && destination) {
			fetchJobSpec(selectedSource.type, destination.type)
		}
	}

	const handleJobTypeChange = (value: JobType) => {
		setJobType(value)
	}

	const handleSubmit = async (values: any) => {
		if (!selectedSource || !selectedDestination) {
			message.error("Please select both source and destination")
			return
		}

		try {
			setSaving(true)
			const jobData: Partial<Job> = {
				name: values.name,
				description: values.description,
				source_id: selectedSource.id,
				destination_id: selectedDestination.id,
				type: jobType,
				config: {
					...formData,
					schedule: values.schedule,
				},
				created_by: user?.id,
			}

			await jobService.createJob(jobData)
			message.success("Job created successfully")
			navigate("/jobs")
		} catch (error) {
			console.error("Error creating job:", error)
			message.error("Failed to create job")
		} finally {
			setSaving(false)
		}
	}

	if (loading) {
		return <div>Loading...</div>
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center space-x-4">
				<Button
					type="text"
					icon={<ArrowLeft size={20} />}
					onClick={() => navigate(-1)}
				/>
				<Title
					level={3}
					className="mb-0"
				>
					Create New Job
				</Title>
			</div>

			<Form
				form={form}
				layout="vertical"
				onFinish={handleSubmit}
				initialValues={{
					schedule: "@daily",
					type: JOB_TYPES.FULL_REFRESH,
				}}
			>
				<Row gutter={[24, 24]}>
					<Col
						xs={24}
						lg={16}
					>
						<Card className="mb-6">
							<StepTitle
								title="Basic Information"
								stepNumber={1}
								className="mb-6"
							/>

							<Form.Item
								name="name"
								label="Job Name"
								rules={[
									{ required: true, message: "Please enter a job name" },
									{
										max: 100,
										message: "Name cannot be longer than 100 characters",
									},
								]}
							>
								<input
									type="text"
									className="w-full rounded border border-gray-300 p-2"
									placeholder="e.g., Production Data Sync"
								/>
							</Form.Item>

							<Form.Item
								name="description"
								label="Description (Optional)"
							>
								<textarea
									className="w-full rounded border border-gray-300 p-2"
									rows={3}
									placeholder="A brief description of this job"
								/>
							</Form.Item>
						</Card>

						<Card className="mb-6">
							<StepTitle
								title="Source & Destination"
								stepNumber={2}
								className="mb-6"
							/>

							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<div>
									<Form.Item
										name="sourceId"
										label="Source"
										rules={[
											{ required: true, message: "Please select a source" },
										]}
									>
										<Select
											placeholder="Select a source"
											onChange={handleSourceChange}
											showSearch
											optionFilterProp="children"
											filterOption={(input, option) =>
												(option?.children ?? "")
													.toLowerCase()
													.includes(input.toLowerCase())
											}
										>
											{sources.map(source => (
												<Option
													key={source.id}
													value={source.id}
												>
													<div className="flex items-center">
														<img
															src={getConnectorImage(source.type)}
															alt={source.type}
															className="mr-2 h-5 w-5"
														/>
														{source.name}
													</div>
												</Option>
											))}
										</Select>
									</Form.Item>

									{selectedSource && (
										<div className="mt-2 flex items-center text-sm text-gray-500">
											<span className="mr-2">Type:</span>
											<span className="font-medium">
												{CONNECTOR_TYPES[selectedSource.type]?.name ||
													selectedSource.type}
											</span>
										</div>
									)}
								</div>

								<div>
									<Form.Item
										name="destinationId"
										label="Destination"
										rules={[
											{
												required: true,
												message: "Please select a destination",
											},
										]}
									>
										<Select
											placeholder="Select a destination"
											onChange={handleDestinationChange}
											showSearch
											optionFilterProp="children"
											filterOption={(input, option) =>
												(option?.children ?? "")
													.toLowerCase()
													.includes(input.toLowerCase())
											}
										>
											{destinations.map(destination => (
												<Option
													key={destination.id}
													value={destination.id}
												>
													<div className="flex items-center">
														<img
															src={getConnectorImage(destination.type)}
															alt={destination.type}
															className="mr-2 h-5 w-5"
														/>
														{destination.name}
													</div>
												</Option>
											))}
										</Select>
									</Form.Item>

									{selectedDestination && (
										<div className="mt-2 flex items-center text-sm text-gray-500">
											<span className="mr-2">Type:</span>
											<span className="font-medium">
												{CONNECTOR_TYPES[selectedDestination.type]?.name ||
													selectedDestination.type}
											</span>
										</div>
									)}
								</div>
							</div>
						</Card>

						{schema && selectedSource && selectedDestination && (
							<Card className="mb-6">
								<StepTitle
									title="Configuration"
									stepNumber={3}
									className="mb-6"
								/>

								<div className="mb-6">
									<Form.Item
										name="type"
										label="Sync Mode"
										rules={[
											{ required: true, message: "Please select a sync mode" },
										]}
									>
										<Select
											options={JOB_TYPE_OPTIONS}
											onChange={handleJobTypeChange}
										/>
									</Form.Item>

									<Form.Item
										name="schedule"
										label="Schedule"
										rules={[
											{ required: true, message: "Please select a schedule" },
										]}
									>
										<Select options={JOB_SCHEDULE_OPTIONS} />
									</Form.Item>
								</div>

								<RJSFForm
									schema={schema}
									uiSchema={uiSchema}
									formData={formData}
									validator={validator}
									onChange={({ formData }) => setFormData(formData)}
									onSubmit={({ formData }) =>
										handleSubmit({ ...form.getFieldsValue(), ...formData })
									}
									templates={{
										ObjectFieldTemplate,
										FieldTemplate: CustomFieldTemplate,
										ArrayFieldTemplate,
									}}
									widgets={widgets}
									transformErrors={transformErrors}
									onError={console.error}
								>
									<div className="flex justify-end">
										<Button
											type="primary"
											htmlType="submit"
											loading={saving}
											className="bg-blue-600"
										>
											Create Job
										</Button>
									</div>
								</RJSFForm>
							</Card>
						)}
					</Col>

					<Col
						xs={24}
						lg={8}
					>
						{selectedSource && selectedDestination && (
							<DocumentationPanel
								connectorType={`${selectedSource.type}-to-${selectedDestination.type}`}
								connectorName={`${CONNECTOR_TYPES[selectedSource.type]?.name || selectedSource.type} to ${CONNECTOR_TYPES[selectedDestination.type]?.name || selectedDestination.type}`}
								docsPath={getConnectorDocumentationPath(
									`${selectedSource.type}-${selectedDestination.type}`,
									{ ...SOURCE_INTERNAL_TYPES, ...DESTINATION_INTERNAL_TYPES },
								)}
							/>
						)}
					</Col>
				</Row>
			</Form>
		</div>
	)
}

export default withAbortController(JobCreation)

import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { Button, Modal, Table, message } from "antd"
import { InfoIcon, Warning } from "@phosphor-icons/react"

import { useAppStore } from "@store/index"
import { sourceService } from "@api/index"
import { destinationService } from "@api/services/destinationService"
import { EntityEditModalProps } from "@app-types/index"
import { getConnectorImage } from "@utils/utils"
import { TEST_CONNECTION_STATUS } from "@utils/constants"

const EntityEditModal = ({ entityType }: EntityEditModalProps) => {
	const navigate = useNavigate()
	const {
		showEditSourceModal,
		setShowEditSourceModal,
		showEditDestinationModal,
		setShowEditDestinationModal,
		setShowSuccessModal,
		setShowTestingModal,
		setShowFailureModal,
		setTestConnectionError,
		selectedEntity,
		updateSource,
		updateDestination,
	} = useAppStore()

	const isSource = entityType === "source"
	const showModal = isSource ? showEditSourceModal : showEditDestinationModal
	const setShowModal = isSource
		? setShowEditSourceModal
		: setShowEditDestinationModal
	const navigatePath = isSource ? "/sources" : "/destinations"

	const getEntityData = () => {
		if (!selectedEntity) return {}
		const { id, name, config, activate } = selectedEntity
		return { id, name, config, activate }
	}

	const updateEntity = async (id: string, data: any) => {
		try {
			if (isSource) {
				await updateSource(id, data)
			} else {
				await updateDestination(id, data)
			}
		} catch (error) {
			console.error(`Error updating ${entityType}:`, error)
			throw error
		}
	}

	const handleEdit = async () => {
		if (!selectedEntity) return

		try {
			setShowTestingModal(true)

			const testResult = isSource
				? await sourceService.testSourceConnection(getEntityData())
				: await destinationService.testDestinationConnection(getEntityData())

			if (
				testResult.data?.connection_result.status ===
				TEST_CONNECTION_STATUS.SUCCEEDED
			) {
				setTimeout(() => {
					setShowTestingModal(false)
					setShowSuccessModal(true)
				}, 1000)

				setTimeout(async () => {
					setShowSuccessModal(false)
					await updateEntity(selectedEntity.id.toString(), selectedEntity)
					message.success(`${entityType} updated successfully`)
					navigate(navigatePath)
				}, 2000)
			} else {
				const testConnectionError = {
					message: testResult.data?.connection_result.message || "",
					logs: testResult.data?.logs || [],
				}
				setShowTestingModal(false)
				setTestConnectionError(testConnectionError)
				setShowFailureModal(true)
			}
		} catch (error) {
			message.error(`Failed to update ${entityType}`)
			console.error(error)
		}
	}

	const getTableColumns = () => {
		const commonColumns = [
			{
				title: "Name",
				dataIndex: "name",
				key: "name",
			},
			{
				title: "Status",
				dataIndex: "activate",
				key: "activate",
				render: (activate: boolean) => (
					<span
						className={`rounded px-2 py-1 text-xs ${
							!activate
								? "bg-danger-light text-danger"
								: "bg-primary-200 text-primary-700"
						}`}
					>
						{activate ? "Active" : "Inactive"}
					</span>
				),
			},
			{
				title: "Last runtime",
				dataIndex: "last_run_time",
				key: "last_run_time",
				render: (text: string) => (
					<span>
						{text !== undefined
							? formatDistanceToNow(new Date(text), {
									addSuffix: true,
								})
							: "-"}
					</span>
				),
			},
		]

		const entitySpecificColumn = {
			title: isSource ? "Destination" : "Source",
			dataIndex: isSource ? "destination_name" : "source_name",
			key: isSource ? "destination_name" : "source_name",
			render: (name: string, record: any) => (
				<div className="flex items-center">
					<img
						src={getConnectorImage(
							record[isSource ? "destination_type" : "source_type"] || "",
						)}
						alt={record[isSource ? "destination_type" : "source_type"]}
						className="mr-2 size-6"
					/>
					{name || "N/A"}
				</div>
			),
		}

		return [...commonColumns, entitySpecificColumn]
	}

	return (
		<>
			<Modal
				title={
					<div className="flex justify-center">
						<Warning
							weight="fill"
							className="size-12 text-primary"
						/>
					</div>
				}
				open={showModal}
				onCancel={() => setShowModal(false)}
				footer={[
					<Button
						key="edit"
						type="primary"
						onClick={handleEdit}
						className="bg-blue-600"
					>
						Confirm
					</Button>,
					<Button
						key="cancel"
						onClick={() => setShowModal(false)}
					>
						Cancel
					</Button>,
				]}
				centered
				width="38%"
			>
				<div className="mt-4 text-center">
					<h3 className="text-lg font-medium">Jobs May Be Affected</h3>
					<p className="mt-2 text-xs text-black text-opacity-45">
						Modifying this {entityType} could affect associated jobs. Are you
						sure you want to continue ?
					</p>
					<div className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-red-600">
						<InfoIcon className="size-4" />
						Ongoing jobs may fail if {entityType} is updated
					</div>
				</div>
				<div className="mt-6">
					<Table
						columns={getTableColumns()}
						dataSource={selectedEntity?.jobs}
						pagination={false}
						rowKey="key"
						scroll={{ y: 300 }}
					/>
				</div>
			</Modal>
		</>
	)
}

export default EntityEditModal

import { useEffect, useState } from "react"
import { message, Modal } from "antd"
import { CopySimpleIcon } from "@phosphor-icons/react"
import clsx from "clsx"

import { useAppStore } from "@store/index"
import ErrorIcon from "@assets/ErrorIcon.svg"
import { getLogTextColor, getLogLevelClass } from "@utils/utils"

const TestConnectionFailureModal = ({
       fromSources,
}: {
       fromSources?: boolean
}) => {
       const { testConnectionError, setTestConnectionError, showFailureModal, setShowFailureModal } =
               useAppStore()

       const [copied, setCopied] = useState(false)

       useEffect(() => {
               let timeout: NodeJS.Timeout
               if (copied) {
                       timeout = setTimeout(() => setCopied(false), 2000)
               }
               return () => clearTimeout(timeout)
       }, [copied])

       const handleCopy = () => {
               if (!testConnectionError) return
               navigator.clipboard.writeText(
                       `Error: ${testConnectionError.message}\n\n${testConnectionError.logs.join("\n")}`
               )
               setCopied(true)
               message.success("Copied to clipboard")
       }

       if (!testConnectionError) return null

       return (
               <Modal
                       open={showFailureModal}
                       onCancel={() => {
                               setShowFailureModal(false)
                               setTestConnectionError(null)
                       }}
                       footer={null}
                       centered
                       width={600}
                       className="test-connection-failure-modal"
               >
                       <div className="flex flex-col items-center">
                               <img src={ErrorIcon} alt="Error" className="mb-4 h-16 w-16" />
                               <h3 className="mb-2 text-xl font-medium">
                                       {fromSources ? "Source" : "Destination"} Connection Failed
                               </h3>
                               <p className="mb-6 text-center text-gray-600">
                                       We couldn't establish a connection to your{" "}
                                       {fromSources ? "source" : "destination"}. Please check the error
                                       details below and try again.
                               </p>

                               <div className="mb-6 w-full rounded-lg border border-red-100 bg-red-50 p-4">
                                       <div className="mb-2 flex items-center justify-between">
                                               <span className="font-medium text-red-700">
                                                       Error Details
                                               </span>
                                               <button
                                                       onClick={handleCopy}
                                                       className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                                               >
                                                       <CopySimpleIcon className="mr-1" size={14} />
                                                       {copied ? "Copied!" : "Copy"}
                                               </button>
                                       </div>
                                       <div className="max-h-40 overflow-y-auto rounded bg-white p-3 text-sm">
                                               <p className="mb-2 font-medium text-red-600">
                                                       {testConnectionError.message}
                                               </p>
                                               {testConnectionError.logs?.length > 0 && (
                                                       <div className="space-y-1">
                                                               {testConnectionError.logs.map((log, i) => (
                                                                       <div
                                                                               key={i}
                                                                               className={clsx(
                                                                                       "font-mono text-xs",
                                                                                       getLogTextColor(log),
                                                                                       getLogLevelClass(log)
                                                                               )}
                                                                       >
                                                                               {log}
                                                                       </div>
                                                               ))}
                                                       </div>
                                               )}
                                       </div>
                               </div>

                               <button
                                       onClick={() => {
                                               setShowFailureModal(false)
                                               setTestConnectionError(null)
                                       }}
                                       className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                               >
                                       Close
                               </button>
                       </div>
               </Modal>
       )
}

export default TestConnectionFailureModal

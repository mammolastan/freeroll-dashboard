import React, { use } from 'react'
import { useEffect, useState } from 'react';


export default function ReadProcessedFiles() {

    const [processedFiles, setProcessedFiles] = useState<Array<{
        drive_file_id: string;
        drive_modified_time: string;
        error_message: string;
        filename: string;
        game_uid: string;
        id: string;
        md5_checksum: string;
        processed_at: string;
        status: string;
    }>>([])

    useEffect(() => {
        fetch('/api/admin/processed-files')
            .then(response => response.json())
            .then(data => {
                setProcessedFiles(data)
            })
    }, [])


    return (
        <>
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {processedFiles.map((file, index) => (
                        <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap">{file.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{file.filename}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{file.status}</td>
                            <td className="px-6 py-4 whitespace-nowrap">{file.error_message}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    )
}

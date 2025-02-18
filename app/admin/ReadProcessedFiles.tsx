// app/admin/ReadProcessedFiles.tsx

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
            <table className="">
                <thead className="">
                    <tr>
                        <th className="">ID</th>
                        <th className="">Filename</th>
                        <th className="">Status</th>
                        <th className="">Message</th>
                        <th className="">Processed</th>
                    </tr>
                </thead>
                <tbody className="">
                    {processedFiles.map((file, index) => (
                        <tr key={index}>
                            <td className="">{file.id}</td>
                            <td className="">{file.filename}</td>
                            <td className="">{file.status}</td>
                            <td className="">{file.error_message}</td>
                            <td className="">{file.processed_at}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    )
}

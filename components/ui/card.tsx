import * as React from "react"

export function Card({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`bg-white shadow rounded-lg ${className}`}
            {...props}
        />
    )
}

export function CardHeader({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={`p-6 ${className}`} {...props} />
}

export function CardTitle({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <h3
            className={`text-2xl font-semibold text-gray-900 ${className}`}
            {...props}
        />
    )
}

export function CardContent({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={`p-6 pt-0 ${className}`} {...props} />
}
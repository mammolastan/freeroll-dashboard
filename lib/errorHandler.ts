// lib/errorHandler.ts
// Reusable error handler utility for API calls

export interface ApiErrorResponse {
    error?: string;
    message?: string;
}

export interface ApiCallOptions {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    errorMessage?: string;
}

export interface ApiCallResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Wrapper for fetch API calls with consistent error handling
 */
export async function apiCall<T = any>(options: ApiCallOptions): Promise<ApiCallResult<T>> {
    const {
        url,
        method = 'GET',
        body,
        headers = {},
        errorMessage = 'API call failed'
    } = options;

    try {
        const fetchOptions: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (body && method !== 'GET') {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);

        if (!response.ok) {
            // Try to parse error response
            try {
                const errorData: ApiErrorResponse = await response.json();
                const errorMsg = errorData.error || errorData.message || `${errorMessage} (${response.status})`;
                return {
                    success: false,
                    error: errorMsg
                };
            } catch {
                // If parsing fails, return generic error
                return {
                    success: false,
                    error: `${errorMessage} (${response.status})`
                };
            }
        }

        // Try to parse successful response
        try {
            const data = await response.json();
            return {
                success: true,
                data
            };
        } catch {
            // If no JSON body (e.g., 204 No Content), return success without data
            return {
                success: true
            };
        }
    } catch (error) {
        console.error('API call error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}

/**
 * Show an alert for API errors
 */
export function handleApiError(result: ApiCallResult, defaultMessage?: string): boolean {
    if (!result.success) {
        alert(result.error || defaultMessage || 'An error occurred');
        return true;
    }
    return false;
}

/**
 * Simplified wrapper for common GET requests
 */
export async function apiGet<T = any>(url: string, errorMessage?: string): Promise<ApiCallResult<T>> {
    return apiCall<T>({ url, method: 'GET', errorMessage });
}

/**
 * Simplified wrapper for common POST requests
 */
export async function apiPost<T = any>(url: string, body: any, errorMessage?: string): Promise<ApiCallResult<T>> {
    return apiCall<T>({ url, method: 'POST', body, errorMessage });
}

/**
 * Simplified wrapper for common PUT requests
 */
export async function apiPut<T = any>(url: string, body: any, errorMessage?: string): Promise<ApiCallResult<T>> {
    return apiCall<T>({ url, method: 'PUT', body, errorMessage });
}

/**
 * Simplified wrapper for common DELETE requests
 */
export async function apiDelete<T = any>(url: string, errorMessage?: string): Promise<ApiCallResult<T>> {
    return apiCall<T>({ url, method: 'DELETE', errorMessage });
}

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { RefreshCw, AlertCircle, WifiOff, ServerOff, FileX, Lock } from "lucide-react";
import { AxiosError } from "axios";

type DataFetchErrorProps = {
  error: unknown;
  onRetry: () => void;
  message?: string;
  className?: string;
};

type ErrorInfo = {
  statusCode: number | null;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const getErrorInfo = (error: unknown): ErrorInfo => {
  // Check if it's an Axios error
  if (error && typeof error === "object" && "isAxiosError" in error) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status || null;

    switch (statusCode) {
      case 400:
        return {
          statusCode: 400,
          title: "Bad Request",
          description: "The request was invalid. Please check your input and try again.",
          icon: <AlertCircle className="h-16 w-16" />,
          color: "text-orange-500 dark:text-orange-400",
        };
      case 401:
        return {
          statusCode: 401,
          title: "Unauthorized",
          description: "You don't have permission to access this resource. Please sign in again.",
          icon: <Lock className="h-16 w-16" />,
          color: "text-yellow-500 dark:text-yellow-400",
        };
      case 403:
        return {
          statusCode: 403,
          title: "Forbidden",
          description: "You don't have permission to perform this action.",
          icon: <Lock className="h-16 w-16" />,
          color: "text-yellow-500 dark:text-yellow-400",
        };
      case 404:
        return {
          statusCode: 404,
          title: "Not Found",
          description: "The requested resource could not be found. It may have been moved or deleted.",
          icon: <FileX className="h-16 w-16" />,
          color: "text-blue-500 dark:text-blue-400",
        };
      case 408:
        return {
          statusCode: 408,
          title: "Request Timeout",
          description: "The request took too long to complete. Please try again.",
          icon: <AlertCircle className="h-16 w-16" />,
          color: "text-orange-500 dark:text-orange-400",
        };
      case 429:
        return {
          statusCode: 429,
          title: "429 - Too Many Requests",
          description: "You've made too many requests. Please wait a moment and try again.",
          icon: <AlertCircle className="h-16 w-16" />,
          color: "text-orange-500 dark:text-orange-400",
        };
      case 500:
        return {
          statusCode: 500,
          title: "Internal Server Error",
          description: "Something went wrong on our end. We're working to fix it. Please try again later.",
          icon: <ServerOff className="h-16 w-16" />,
          color: "text-red-500 dark:text-red-400",
        };
      case 502:
        return {
          statusCode: 502,
          title: "Bad Gateway",
          description: "The server received an invalid response. Please try again later.",
          icon: <ServerOff className="h-16 w-16" />,
          color: "text-red-500 dark:text-red-400",
        };
      case 503:
        return {
          statusCode: 503,
          title: "Service Unavailable",
          description: "The service is temporarily unavailable. Please try again later.",
          icon: <ServerOff className="h-16 w-16" />,
          color: "text-red-500 dark:text-red-400",
        };
      case 504:
        return {
          statusCode: 504,
          title: "Gateway Timeout",
          description: "The server took too long to respond. Please try again later.",
          icon: <ServerOff className="h-16 w-16" />,
          color: "text-red-500 dark:text-red-400",
        };
      default:
        // Network error or no response
        if (!axiosError.response) {
          return {
            statusCode: null,
            title: "Network Error",
            description: "Unable to connect to the server. Please check your internet connection and try again.",
            icon: <WifiOff className="h-16 w-16" />,
            color: "text-red-500 dark:text-red-400",
          };
        }
        return {
          statusCode: statusCode,
          title: `${statusCode} - Error`,
          description: getErrorMessage(error),
          icon: <AlertCircle className="h-16 w-16" />,
          color: "text-red-500 dark:text-red-400",
        };
    }
  }

  // Handle non-axios errors
  const errorMessage = getErrorMessage(error);
  return {
    statusCode: null,
    title: "Error",
    description: errorMessage,
    icon: <AlertCircle className="h-16 w-16" />,
    color: "text-red-500 dark:text-red-400",
  };
};

const DataFetchError = ({
  error,
  onRetry,
  message,
  className = "",
}: DataFetchErrorProps) => {
  const errorInfo = getErrorInfo(error);
  const customMessage = message ? `${message}: ${errorInfo.description}` : errorInfo.description;

  return (
    <div
      className={`flex flex-col justify-center items-center min-h-[400px] gap-6 px-4 ${className}`}
    >
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        {/* Status Code Display */}
        {errorInfo.statusCode && (
          <div className="relative">
            <div className="text-8xl font-bold text-gray-200 dark:text-gray-800 select-none">
              {errorInfo.statusCode}
            </div>
            
          </div>
        )}

        {/* Icon for non-status code errors */}
        {!errorInfo.statusCode && (
          <div className={errorInfo.color}>{errorInfo.icon}</div>
        )}

        {/* Title */}
        <div>
          <h3 className="text-2xl font-semibold text-foreground mb-2">
            {errorInfo.title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {customMessage}
          </p>
        </div>
      </div>

      {/* Retry Button */}
      <Button onClick={onRetry} variant="outline" size="default" className="mt-2">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  );
};

export default DataFetchError;


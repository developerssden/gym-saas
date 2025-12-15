export const toDate = (value?: string) =>
    value ? new Date(value) : undefined;
  
export  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString() : "Select date";
  
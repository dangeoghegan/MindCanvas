// services/fileService.ts

export const downloadFile = (file: File): void => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const finalName = `granula-${Date.now()}-${cleanName}`;

  link.download = finalName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

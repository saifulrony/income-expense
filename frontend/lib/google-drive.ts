// Google Drive Integration for Backup & Restore

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size?: string;
}

export class GoogleDriveService {
  private static clientIdKey = 'gdrive_client_id';
  private static tokenKey = 'gdrive_access_token';

  static getClientId(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.clientIdKey) || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    }
    return '';
  }

  static setClientId(id: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.clientIdKey, id);
    }
  }

  static getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  static setAccessToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  static clearAccessToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
    }
  }

  // Upload backup payload to Google Drive
  static async uploadBackup(payload: any, accessToken: string): Promise<GoogleDriveFile> {
    const fileName = `income_expense_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const fileContent = JSON.stringify(payload, null, 2);

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: 'Income & Expense App Backup',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to upload backup to Google Drive');
    }

    return await response.json();
  }

  // List backup files from Google Drive
  static async listBackups(accessToken: string): Promise<GoogleDriveFile[]> {
    const query = encodeURIComponent("name contains 'income_expense_backup_' and trashed = false");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,createdTime,size)&orderBy=createdTime desc`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'Failed to list backups from Google Drive');
    }

    const data = await response.json();
    return data.files || [];
  }

  // Download backup content from Google Drive
  static async downloadBackup(fileId: string, accessToken: string): Promise<any> {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download backup file from Google Drive');
    }

    return await response.json();
  }
}

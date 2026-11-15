// Google Drive Integration for Backup & Restore with 1-Click Google Identity Services (GIS)

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  size?: string;
}

export interface GoogleUserProfile {
  email?: string;
  name?: string;
  picture?: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export class GoogleDriveService {
  private static clientIdKey = 'gdrive_client_id';
  private static tokenKey = 'gdrive_access_token';
  private static userProfileKey = 'gdrive_user_profile';

  static getClientId(): string {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.clientIdKey) || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    }
    return '';
  }

  static setClientId(id: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.clientIdKey, id.trim());
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
      localStorage.removeItem(this.userProfileKey);
    }
  }

  static getUserProfile(): GoogleUserProfile | null {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(this.userProfileKey);
      if (data) {
        try {
          return JSON.parse(data);
        } catch (e) {}
      }
    }
    return null;
  }

  static setUserProfile(profile: GoogleUserProfile | null): void {
    if (typeof window !== 'undefined') {
      if (profile) {
        localStorage.setItem(this.userProfileKey, JSON.stringify(profile));
      } else {
        localStorage.removeItem(this.userProfileKey);
      }
    }
  }

  // Load Google Identity Services SDK asynchronously
  static async loadGsi(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (window.google?.accounts?.oauth2) return;

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('google-gsi-client');
      if (existingScript) {
        if (window.google?.accounts?.oauth2) {
          resolve();
        } else {
          existingScript.addEventListener('load', () => resolve());
        }
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services library.'));
      document.body.appendChild(script);
    });
  }

  // 1-Click Sign in with Google (OAuth2 Token Client)
  static async signInWithGoogle(customClientId?: string): Promise<{ token: string; profile: GoogleUserProfile | null }> {
    const clientId = (customClientId || this.getClientId()).trim();
    if (!clientId) {
      throw new Error('MISSING_CLIENT_ID');
    }

    await this.loadGsi();

    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services is unavailable.');
    }

    return new Promise((resolve, reject) => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          callback: async (response: any) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }
            if (response.access_token) {
              this.setAccessToken(response.access_token);
              this.setClientId(clientId);

              let profile: GoogleUserProfile | null = null;
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${response.access_token}` },
                });
                if (userRes.ok) {
                  profile = await userRes.json();
                  this.setUserProfile(profile);
                }
              } catch (e) {
                console.warn('Could not fetch Google profile', e);
              }

              resolve({ token: response.access_token, profile });
            } else {
              reject(new Error('No access token received from Google.'));
            }
          },
        });

        // Trigger Google Login account picker
        client.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  static disconnect(): void {
    this.clearAccessToken();
    if (typeof window !== 'undefined') {
      localStorage.setItem('auto_drive_sync', 'false');
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


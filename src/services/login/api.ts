import { LoginService, LoginRequestData, LoginResponseData } from "./interface";

export class LoginApiService extends LoginService {
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  public async login(payload: LoginRequestData): Promise<LoginResponseData> {
    const response: LoginResponseData = await this.fetchPost(
      "/login/",
      { method: "POST" },
      payload
    );

    this.storeInLocalStorage(response);

    return response;
  }

  public logout() {
    this.removeFromLocalStorage();
  }

  public async getCurrentToken(): Promise<LoginResponseData | null> {
    return this.retrieveFromLocalStorage();
  }

  public async getValidToken(): Promise<LoginResponseData | null> {
    const token = await this.getCurrentToken();
    if (!token || !token.access) {
      this.logout();
      return null;
    }

    try {
      const parsedToken = this.parseJwt(token?.access);

      if (new Date().getTime() / 1000 > parsedToken.exp) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          try {
            const response: LoginResponseData = await this.fetchPost(
              "/refresh/",
              { method: "POST" },
              { refresh: token.refresh }
            );
            this.storeInLocalStorage(response);
            this.isRefreshing = false;
            this.onRefreshed(response.access);
          } catch (e) {
            console.log(e);
            this.logout();
          } finally {
            this.isRefreshing = false;
          }
        } else {
          return new Promise((resolve) => {
            this.addRefreshSubscriber((newToken: string) => {
              resolve(this.retrieveFromLocalStorage());
            });
          });
        }
      }
      return this.retrieveFromLocalStorage();
    } catch (e) {
      console.log(e);
      this.logout();
    }
    return null;
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private loginDataKey = "loginData";

  private storeInLocalStorage = (payload: LoginResponseData) => {
    localStorage.setItem(this.loginDataKey, JSON.stringify(payload));
  };

  private retrieveFromLocalStorage = (): LoginResponseData | null => {
    try {
      const serializedLoginData = localStorage.getItem(this.loginDataKey);
      if (!serializedLoginData) {
        throw new Error("Not logged in");
      }
      return JSON.parse(serializedLoginData);
    } catch {
      return null;
    }
  };

  private removeFromLocalStorage = (): void => {
    localStorage.removeItem(this.loginDataKey);
  };

  // https://stackoverflow.com/questions/38552003/how-to-decode-jwt-token-in-javascript-without-using-a-library
  private parseJwt(token: string) {
    var base64Url = token.split(".")[1];
    var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    var jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload);
  }
}

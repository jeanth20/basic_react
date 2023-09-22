// Importing necessary modules and libraries from React and other packages
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react";
import PocketBase from "pocketbase";
import { useInterval } from "usehooks-ts"; // Custom hook for handling intervals
import jwtDecode from "jwt-decode"; // Library for decoding JWT tokens
import ms from "ms"; // Library for parsing time durations

// Define the base URL for the API
const BASE_URL = "http://127.0.0.1:8090";

// Define time durations in milliseconds
const fiveMinutesInMs = ms("5 minutes");
const twoMinutesInMs = ms("2 minutes");

// Create a React context for the Pocket application
const PocketContext = createContext({});

// Export a component called PocketProvider, which wraps the application with context
export const PocketProvider = ({ children }) => {
  // Create an instance of PocketBase with the specified base URL
  const pb = useMemo(() => new PocketBase(BASE_URL), []);

  // State variables to manage the user's token and user model
  const [token, setToken] = useState(pb.authStore.token);
  const [user, setUser] = useState(pb.authStore.model);

  // Effect hook to listen for changes in authentication state
  useEffect(() => {
    // When the token or user model changes, update the state variables
    return pb.authStore.onChange((token, model) => {
      setToken(token);
      setUser(model);
    });
  }, []);

  // Function to register a new user asynchronously
  const register = useCallback(async (email, password) => {
    return await pb
      .collection("users")
      .create({ email, password, passwordConfirm: password });
  }, []);

  // Function to log in a user asynchronously
  const login = useCallback(async (email, password) => {
    return await pb.collection("users").authWithPassword(email, password);
  }, []);

  // Function to log out a user
  const logout = useCallback(() => {
    pb.authStore.clear();
  }, []);

  // Function to refresh the user's session if the token is close to expiration
  const refreshSession = useCallback(async () => {
    // Check if the token is valid
    if (!pb.authStore.isValid) return;
    const decoded = jwtDecode(token);
    const tokenExpiration = decoded.exp;
    const expirationWithBuffer = (decoded.exp + fiveMinutesInMs) / 1000;

    // If the token is close to expiration, refresh it
    if (tokenExpiration < expirationWithBuffer) {
      await pb.collection("users").authRefresh();
    }
  }, [token]);

  // Use the custom useInterval hook to periodically refresh the session
  useInterval(refreshSession, token ? twoMinutesInMs : null);

  // Provide the authentication and user-related functions and data to the application via context
  return (
    <PocketContext.Provider
      value={{ register, login, logout, user, token, pb }}
    >
      {children}
    </PocketContext.Provider>
  );
};

// Export a custom hook called usePocket for accessing the PocketContext
export const usePocket = () => useContext(PocketContext);

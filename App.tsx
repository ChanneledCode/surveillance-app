// App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Button,
  View,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaDevices, MediaStream } from 'react-native-webrtc'; // Import MediaStream type
import io from 'socket.io-client';
import { Socket } from 'socket.io-client'; // Import Socket type
declare module 'simple-peer';
import Peer from 'simple-peer';
import axios from 'axios';

// Main App component
const App = () => {
  // State variables
  const [username, setUsername] = useState(''); // Stores the username input
  const [password, setPassword] = useState(''); // Stores the password input
  const [authToken, setAuthToken] = useState(null); // Stores the authentication token after login
  const [socket, setSocket] = useState<Socket | null>(null); // Update state type to allow Socket
  const [stream, setStream] = useState<MediaStream | null>(null); // Stores the media stream from camera and mic
  const [peer, setPeer] = useState<ReturnType<typeof Peer> | null>(null); // Use ReturnType to infer the type

  // Function to handle user login
  const handleLogin = async () => {
    try {
      // Send a POST request to the server's /login endpoint
      const response = await axios.post('http://your-server-ip:5000/login', {
        username,
        password,
      });
      const { token } = response.data;

      // Store the token in AsyncStorage and update authToken state
      await AsyncStorage.setItem('authToken', token);
      setAuthToken(token);

      console.log('Login successful');
    } catch (error) {
      console.error('Login failed:', error);
      Alert.alert('Login Failed', 'Invalid username or password.');
    }
  };

  // Function to start the media stream from camera and microphone
  const startMediaStream = async () => {
    try {
      // Request access to the media devices
      const mediaStream = await mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setStream(mediaStream);
      console.log('Media stream started successfully');
    } catch (error) {
      console.error('Error starting media stream:', error);
      Alert.alert('Media Error', 'Could not access camera and microphone.');
    }
  };

  // Function to initialize the socket connection and set up WebRTC
  const initializeConnection = useCallback(() => {
    // Create a new Socket.IO client instance
    const newSocket = io('http://your-server-ip:5000', {
      auth: {
        token: authToken, // Send the auth token for authentication
      },
    });

    // Socket connection successful
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setSocket(newSocket);
    });

    // Handle connection errors
    newSocket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      Alert.alert('Connection Error', 'Could not connect to the server.');
    });

    // Set up WebRTC peer connection if media stream is available
    if (stream) {
      const newPeer = new Peer({
        initiator: true, // This device initiates the connection
        trickle: false,  // Disable trickle ICE for simplicity
        stream: stream,  // Attach the media stream to the peer connection
      });

      // When the peer generates signaling data (offer)
      newPeer.on('signal', (data: any) => { // Specify 'data' type as 'any'
        // Send the signaling data to the server to forward to the monitoring client
        newSocket.emit('webrtc-offer', data);
      });

      // Receive the answer from the monitoring client
      newSocket.on('webrtc-answer', (data) => {
        newPeer.signal(data); // Complete the WebRTC handshake
      });

      // Handle successful connection
      newPeer.on('connect', () => {
        console.log('WebRTC connection established');
      });

      // Handle errors
      newPeer.on('error', (err: Error) => { // Specify 'err' type as 'Error'
        console.error('WebRTC error:', err);
      });

      setPeer(newPeer); // Store the peer connection
    } else {
      console.error('Media stream is not available for WebRTC.');
    }
  }, [authToken, stream]); // Add dependencies

  // Effect hook to start media stream after authentication
  useEffect(() => {
    if (authToken) {
      startMediaStream();
    }
  }, [authToken]);

  // Effect hook to initialize connection after media stream is ready
  useEffect(() => {
    if (stream && authToken) {
      initializeConnection();
    }
  }, [stream, authToken, initializeConnection]); // Removed initializeConnection from dependencies

  // Cleanup resources when the component unmounts
  useEffect(() => { 
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (peer) {
        peer.destroy(); // Now 'peer' is of type Peer
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, [stream, authToken, initializeConnection, peer, socket]); // Added 'peer' and 'socket' to dependencies

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#f4511e" barStyle="light-content" />
      {!authToken ? (
        // Login form if not authenticated
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Surveillance App Login</Text>
          <TextInput
            style={styles.input}
            placeholder="Username"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button title="Login" onPress={handleLogin} />
        </View>
      ) : (
        // Show streaming status if authenticated
        <View style={styles.streamingContainer}>
          <Text style={styles.streamingText}>Streaming Video and Audio...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// Stylesheet for the components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loginContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  streamingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamingText: {
    fontSize: 20,
    color: '#f4511e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    color: '#f4511e',
  },
  input: {
    height: 50,
    borderColor: '#cccccc',
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 18,
  },
});

export default App;

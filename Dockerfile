# Use an official Node.js runtime as the base image.
# Using 'lts-slim' is recommended for production as it is smaller than the default image.
FROM node:20-lts-slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# --- Install Dependencies ---

# Copy package.json and package-lock.json first. 
# This layer caches the dependencies, speeding up rebuilds if only the code changes.
# Assuming you are using 'require' syntax as per the last fixed code, 
# you should be using 'package.json' and 'package-lock.json'.
COPY package*.json ./

# Install project dependencies
RUN npm install

# --- Copy Application Code ---

# Copy the rest of the application code into the container
# This copies your server.js (or 1.js if that's what you are running)
COPY . .

# --- Container Configuration ---

# The port your Express server listens on (PORT = 3000 in your server.js)
EXPOSE 3000

# Define the command to run your application.
# This assumes your main server file is named server.js, 
# but if you run 'node 1.js', change 'server.js' below.
CMD [ "node", "1.js" ]
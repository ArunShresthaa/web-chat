module.exports = {
  apps: [
    {
      name: "yt",
      script: "uvicorn",
      args: 'main:app --host 0.0.0.0',
      exec_mode: "fork",
      interpreter: 'C:\\Users\\ArunShrestha\\anaconda3\\envs\\yt-transcript\\python',
    },
  ],
};
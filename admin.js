<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SUBRA · Admin</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <!-- Behold gerne din eksisterende admin-markup.
       Denne simple container er nok, hvis admin.js selv tegner UI’et. -->
  <div id="admin-root"></div>

  <!-- ======================= -->
  <!-- SCRIPTS: RIGTIG RÆKKEFØLGE -->
  <!-- 1) Firebase SDK (compat) -->
  <!-- 2) Konfig-filer          -->
  <!-- 3) Adapter + admin app   -->
  <!-- ======================= -->

  <!-- 1) Firebase SDK (compat) – UDEN integrity/crossorigin -->
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>

  <!-- 2) Vores konfiguration (skal komme før adapter/app) -->
  <script src="firebase-config.js"></script>
  <script src="local-config.js"></script>
  <script src="defaults.js"></script>

  <!-- 3) Adapter + admin-app -->
  <script src="firebase-adapter.js"></script>
  <script src="admin.js"></script>
</body>
</html>

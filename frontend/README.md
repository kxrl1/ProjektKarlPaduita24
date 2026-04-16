# Energia Armatuurlaud (Energy Dashboard)

See on täislahendusega veebirakendus elektrihindade jälgimiseks ja analüüsimiseks. Rakendus kasutab Reacti andmete kuvamiseks ja Node.js/Expressi andmete haldamiseks ning sünkroonimiseks Eleringi süsteemiga.

## Tehnoloogiad

* **Frontend:** React 19, Vite, Material UI (MUI), MUI X-Charts.
* **Backend:** Node.js, Express, Sequelize ORM.
* **Andmebaas:** MySQL / MariaDB.
* **Andmeallikas:** [Elering Dashboard API](https://dashboard.elering.ee/et/api-docs).

---

## Rakenduse käivitamine (Samm-sammult)

Rakenduse korrektseks tööks on vaja avada **kaks eraldi terminaliakent** (või vahelehte), et nii server (backend) kui ka klient (frontend) töötaksid korraga.

### 1. Eeldused
* Sinu arvutisse on paigaldatud [Node.js](https://nodejs.org/).
* Sul on töötav **MySQL** andmebaas.
* Sinu arvutis on paigaldatud **Git**.

### 2. Projekti kloonimine

Kõigepealt laadi projekt enda arvutisse ja liigu projekti kausta:

git clone git@github.com:kxrl1/ProjektKarlPaduita24.git

### 3. Backendi seadistamine

cd backend

npm run dev

### 4. Frontendi seadistamine

cd frontend

npm run dev
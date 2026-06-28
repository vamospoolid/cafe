-- CreateTable
CREATE TABLE "Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "waktuBuka" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waktuTutup" DATETIME,
    "saldoAwal" REAL NOT NULL,
    "saldoSistem" REAL,
    "saldoFisikLaci" REAL,
    "selisih" REAL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

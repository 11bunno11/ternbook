while (true) {
  for (site of knownSites) {
    fetch(site + "/.well-known/ternbook.json")

    if (valid) {
      updateDatabase(siteData)

      for (neighbor of siteData.neighbors) {
        if (!knownSites.includes(neighbor)) {
          addToQueue(neighbor)
        }
      }
    }
  }

  sleep(6 * 60 * 60 * 1000)
}